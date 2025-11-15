import { Injectable, Logger } from '@nestjs/common';
import { ProjectAnalysis } from '../provider/dto/deployment.dto';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class ProjectAnalysisService {
  private readonly logger = new Logger(ProjectAnalysisService.name);

  async analyzeProject(projectPath: string): Promise<ProjectAnalysis> {
    try {
      this.logger.log(`Analyzing project at: ${projectPath}`);

      const analysis: ProjectAnalysis = {
        type: 'unknown',
        hasPackageJson: false,
        hasBuildScript: false,
        isStaticHtml: false,
        estimatedSize: 0,
        dependencies: [],
        environmentVariables: [],
      };

      // Check if package.json exists
      const packageJsonPath = path.join(projectPath, 'package.json');
      try {
        const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
        const packageJson = JSON.parse(packageJsonContent);
        analysis.hasPackageJson = true;
        analysis.dependencies = Object.keys(packageJson.dependencies || {});

        // Check for build script
        if (packageJson.scripts && packageJson.scripts.build) {
          analysis.hasBuildScript = true;
          analysis.buildCommand = packageJson.scripts.build;
        }

        // Detect framework and type from dependencies
        const frameworkDetection = this.detectFrameworkFromDependencies(analysis.dependencies);
        analysis.framework = frameworkDetection.framework;
        analysis.type = frameworkDetection.type;

        // Detect environment variables
        analysis.environmentVariables = this.detectEnvironmentVariables(packageJson);

        // Determine build directory
        analysis.buildDirectory = this.detectBuildDirectory(packageJson, analysis.framework);
      } catch (error) {
        this.logger.debug('No package.json found or invalid format');
      }

      // Check for static HTML files
      if (!analysis.hasPackageJson) {
        analysis.isStaticHtml = await this.checkStaticHtmlProject(projectPath);
        if (analysis.isStaticHtml) {
          analysis.type = 'static';
          analysis.framework = 'html';
        }
      }

      // Check for specific framework files
      await this.detectFrameworkFromFiles(projectPath, analysis);

      // Calculate estimated project size
      analysis.estimatedSize = await this.calculateProjectSize(projectPath);

      this.logger.log(`Project analysis complete: ${analysis.type} (${analysis.framework})`);
      return analysis;
    } catch (error) {
      this.logger.error('Failed to analyze project:', error);
      return {
        type: 'unknown',
        hasPackageJson: false,
        hasBuildScript: false,
        isStaticHtml: false,
        estimatedSize: 0,
      };
    }
  }

  private detectFrameworkFromDependencies(dependencies: string[]): { framework?: string; type: ProjectAnalysis['type'] } {
    const deps = dependencies.map(d => d.toLowerCase());

    // Check for Vite first (before generic React detection)
    if (deps.includes('vite')) {
      const isReact = deps.includes('react');
      const isVue = deps.includes('vue');
      return { framework: isReact ? 'React (Vite)' : isVue ? 'Vue (Vite)' : 'vite', type: 'spa' };
    }

    // React frameworks
    if (deps.includes('next')) {
      return { framework: 'next', type: 'next' };
    }
    if (deps.includes('gatsby')) {
      return { framework: 'gatsby', type: 'static' };
    }
    if (deps.includes('react')) {
      return { framework: 'react', type: 'spa' };
    }

    // Vue frameworks
    if (deps.includes('nuxt')) {
      return { framework: 'nuxt', type: 'nuxt' };
    }
    if (deps.includes('vue')) {
      return { framework: 'vue', type: 'spa' };
    }

    // Angular
    if (deps.includes('@angular/core')) {
      return { framework: 'angular', type: 'spa' };
    }

    // Svelte
    if (deps.includes('svelte')) {
      return { framework: 'svelte', type: 'spa' };
    }

    // Express/Node.js API
    if (deps.includes('express') || deps.includes('fastify') || deps.includes('koa')) {
      return { framework: 'node', type: 'static' };
    }

    // Default for projects with package.json
    return { type: 'static' };
  }

  private async detectFrameworkFromFiles(projectPath: string, analysis: ProjectAnalysis): Promise<void> {
    try {
      const files = await fs.readdir(projectPath);

      // Check for framework-specific files
      if (files.includes('next.config.js') || files.includes('next.config.ts')) {
        analysis.framework = 'next';
        analysis.type = 'next';
      } else if (files.includes('gatsby-config.js') || files.includes('gatsby-config.ts')) {
        analysis.framework = 'gatsby';
        analysis.type = 'static';
      } else if (files.includes('angular.json')) {
        analysis.framework = 'angular';
        analysis.type = 'spa';
      } else if (files.includes('nuxt.config.js') || files.includes('nuxt.config.ts')) {
        analysis.framework = 'nuxt';
        analysis.type = 'nuxt';
      } else if (files.includes('svelte.config.js')) {
        analysis.framework = 'svelte';
        analysis.type = 'spa';
      } else if (files.includes('vite.config.js') || files.includes('vite.config.ts')) {
        // Vite could be used with various frameworks - update framework to indicate Vite usage
        if (analysis.framework === 'react') {
          analysis.framework = 'React (Vite)';
        } else if (analysis.framework === 'vue') {
          analysis.framework = 'Vue (Vite)';
        } else if (!analysis.framework) {
          analysis.framework = 'vite';
          analysis.type = 'spa';
        }
      }

      // Check for Dockerfile
      if (files.includes('Dockerfile')) {
        // Docker projects can be deployed to container platforms
        analysis.type = 'static'; // Still deployable to static hosting if built correctly
      }
    } catch (error) {
      this.logger.debug('Error reading project files:', error);
    }
  }

  private async checkStaticHtmlProject(projectPath: string): Promise<boolean> {
    try {
      const files = await fs.readdir(projectPath);
      
      // Check for HTML files
      const hasHtmlFiles = files.some(file => file.endsWith('.html'));
      
      // Check for common static file patterns
      const hasStaticFiles = files.some(file => 
        file.endsWith('.css') || 
        file.endsWith('.js') || 
        file.endsWith('.png') || 
        file.endsWith('.jpg') || 
        file.endsWith('.jpeg') ||
        file.endsWith('.gif') ||
        file.endsWith('.svg')
      );

      // If there's an index.html and no package.json, likely a static HTML project
      const hasIndexHtml = files.includes('index.html');
      
      return hasIndexHtml && (hasHtmlFiles || hasStaticFiles);
    } catch (error) {
      return false;
    }
  }

  private detectEnvironmentVariables(packageJson: any): string[] {
    const envVars: string[] = [];
    
    // Check scripts for environment variable references
    const scripts = packageJson.scripts || {};
    const scriptContent = Object.values(scripts).join(' ');
    
    // Look for common environment variable patterns
    const envPatterns = [
      /\$([A-Z_][A-Z0-9_]*)/g, // $VAR_NAME
      /process\.env\.([A-Z_][A-Z0-9_]*)/g, // process.env.VAR_NAME
      /import\.meta\.env\.([A-Z_][A-Z0-9_]*)/g, // import.meta.env.VAR_NAME (Vite)
    ];

    envPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(scriptContent)) !== null) {
        if (match[1] && !envVars.includes(match[1])) {
          envVars.push(match[1]);
        }
      }
    });

    return envVars;
  }

  private detectBuildDirectory(packageJson: any, framework?: string): string | undefined {
    // Priority-based detection for bulletproof reliability
    
    // 1. Check package.json build script for explicit output directory
    const scripts = packageJson?.scripts || {};
    const buildScript = scripts.build || '';
    
    const buildDirPatterns = [
      /--outDir[\s=]([^\s]+)/,
      /--out-dir[\s=]([^\s]+)/,
      /--output[\s=]([^\s]+)/,
      /--dist[\s=]([^\s]+)/,
    ];

    for (const pattern of buildDirPatterns) {
      const match = pattern.exec(buildScript);
      if (match && match[1]) {
        return match[1];
      }
    }

    // 2. Framework-specific defaults (bulletproof mappings)
    switch (framework) {
      // Vite projects ALWAYS use 'dist'
      case 'React (Vite)':
      case 'Vue (Vite)':
      case 'vite':
      case 'Vite':
        return 'dist';
      
      // Create React App uses 'build'
      case 'React (CRA)':
        return 'build';
      
      // Next.js uses '.next' for dev, but 'out' for static export
      case 'Next.js':
      case 'next':
        return '.next';
      
      // Gatsby uses 'public'
      case 'Gatsby':
      case 'gatsby':
        return 'public';
      
      // Nuxt uses '.nuxt/dist' or 'dist'
      case 'Nuxt.js':
      case 'nuxt':
        return 'dist';
      
      // Vue CLI uses 'dist'
      case 'Vue.js':
      case 'vue':
        return 'dist';
      
      // Angular uses 'dist'
      case 'Angular':
      case 'angular':
        return 'dist';
      
      // Svelte typically uses 'dist' or 'build'
      case 'Svelte':
      case 'svelte':
        return 'dist';
      
      // 11ty uses '_site'
      case '11ty':
        return '_site';
      
      // Generic React without framework - assume 'build'
      case 'React':
      case 'react':
        return 'build';
      
      // Static HTML - no build directory
      case 'Static HTML':
      case 'Static':
        return '.';
      
      default:
        // 3. Intelligent fallback based on build script content
        if (buildScript.includes('vite')) return 'dist';
        if (buildScript.includes('dist')) return 'dist';
        if (buildScript.includes('build')) return 'build';
        if (buildScript.includes('public')) return 'public';
        
        // 4. Ultimate safe default
        return 'dist'; // Most modern tools use 'dist'
    }
  }

  private async calculateProjectSize(projectPath: string): Promise<number> {
    try {
      let totalSize = 0;

      async function calculateDirSize(dirPath: string): Promise<number> {
        let size = 0;
        const entries = await fs.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
          const entryPath = path.join(dirPath, entry.name);
          
          // Skip common directories that shouldn't be included in size calculation
          if (entry.isDirectory() && ['node_modules', '.git', '.next', '.nuxt', 'dist', 'build'].includes(entry.name)) {
            continue;
          }

          if (entry.isDirectory()) {
            size += await calculateDirSize(entryPath);
          } else {
            const stats = await fs.stat(entryPath);
            size += stats.size;
          }
        }

        return size;
      }

      totalSize = await calculateDirSize(projectPath);
      
      // Convert to MB
      return Math.round(totalSize / (1024 * 1024) * 100) / 100;
    } catch (error) {
      this.logger.error('Failed to calculate project size:', error);
      return 0;
    }
  }
}
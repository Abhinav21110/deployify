import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import { DetectedStack } from '../common/types';

@Injectable()
export class StackDetectionService {
  private readonly logger = new Logger(StackDetectionService.name);

  async analyzeProject(workspaceDir: string): Promise<DetectedStack> {
    try {
      const files = await this.scanProjectFiles(workspaceDir);
      
      // Check for specific files and patterns
      const hasPackageJson = files.includes('package.json');
      const hasDockerfile = files.includes('Dockerfile') || files.includes('dockerfile');
      const hasRequirementsTxt = files.includes('requirements.txt');
      const hasPomXml = files.includes('pom.xml');
      const hasIndexHtml = files.includes('index.html');
      
      let packageJson: any = null;
      if (hasPackageJson) {
        packageJson = await this.readPackageJson(path.join(workspaceDir, 'package.json'));
      }

      // Detect framework and type
      const detected = await this.detectFrameworkAndType(files, packageJson, workspaceDir);

      return {
        ...detected,
        type: detected.type ?? 'static',
        framework: detected.framework ?? 'unknown',
        hasDockerfile,
        packageManager: await this.detectPackageManager(workspaceDir),
        nodeVersion: packageJson?.engines?.node,
        dependencies: packageJson?.dependencies || {},
      };
    } catch (error) {
      this.logger.error('Failed to analyze project:', error);
      
      // Fallback detection
      return {
        type: 'static',
        framework: 'unknown',
        packageManager: 'npm',
        hasDockerfile: false,
      };
    }
  }

  private async scanProjectFiles(dir: string, maxDepth = 2): Promise<string[]> {
    const files: string[] = [];
    
    const scan = async (currentDir: string, depth: number) => {
      if (depth > maxDepth) return;
      
      try {
        const items = await fs.readdir(currentDir, { withFileTypes: true });
        
        for (const item of items) {
          if (item.name.startsWith('.') && !['Dockerfile', '.dockerfile'].includes(item.name)) {
            continue; // Skip hidden files except Dockerfile variants
          }
          
          if (item.isFile()) {
            files.push(item.name);
          } else if (item.isDirectory() && depth < maxDepth) {
            await scan(path.join(currentDir, item.name), depth + 1);
          }
        }
      } catch (error) {
        // Ignore permission errors
      }
    };
    
    await scan(dir, 0);
    return files;
  }

  private async readPackageJson(packageJsonPath: string): Promise<any> {
    try {
      const content = await fs.readFile(packageJsonPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      return null;
    }
  }

  private async detectFrameworkAndType(
    files: string[],
    packageJson: any,
    workspaceDir: string,
  ): Promise<Partial<DetectedStack>> {
    const dependencies = { ...packageJson?.dependencies, ...packageJson?.devDependencies };
    
    // Priority-based detection for maximum reliability
    
    // 1. Check for Vite first (highest priority for modern projects)
    if (dependencies?.['vite'] || files.includes('vite.config.js') || files.includes('vite.config.ts')) {
      const isReact = dependencies?.['react'];
      const isVue = dependencies?.['vue'];
      
      return {
        type: 'spa',
        framework: isReact ? 'React (Vite)' : isVue ? 'Vue (Vite)' : 'Vite',
        buildCmd: 'npm run build',
        distDir: 'dist', // Vite ALWAYS uses dist
      };
    }
    
    // 2. Next.js detection (React-based SSR framework)
    if (dependencies?.['next'] || files.includes('next.config.js') || files.includes('next.config.ts')) {
      return {
        type: 'ssr',
        framework: 'Next.js',
        buildCmd: 'npm run build',
        distDir: '.next', // Next.js uses .next, but deployment uses 'out' for static export
        portHint: 3000,
      };
    }
    
    // 3. Gatsby detection (React-based static site generator)
    if (dependencies?.['gatsby'] || files.includes('gatsby-config.js') || files.includes('gatsby-config.ts')) {
      return {
        type: 'static',
        framework: 'Gatsby',
        buildCmd: 'npm run build',
        distDir: 'public', // Gatsby uses public directory
      };
    }
    
    // 4. Remix detection
    if (dependencies?.['@remix-run/node'] || dependencies?.['@remix-run/dev']) {
      return {
        type: 'ssr',
        framework: 'Remix',
        buildCmd: 'npm run build',
        distDir: 'build',
        portHint: 3000,
      };
    }
    
    // 5. Vue-based frameworks (Nuxt)
    if (dependencies?.['nuxt'] || files.includes('nuxt.config.js') || files.includes('nuxt.config.ts')) {
      return {
        type: 'ssr',
        framework: 'Nuxt.js',
        buildCmd: 'npm run build',
        distDir: '.nuxt/dist',
        portHint: 3000,
      };
    }
    
    // 6. Vue CLI projects
    if (dependencies?.['@vue/cli-service'] || files.includes('vue.config.js')) {
      return {
        type: 'spa',
        framework: 'Vue.js',
        buildCmd: 'npm run build',
        distDir: 'dist',
      };
    }
    
    // 7. Angular projects
    if (dependencies?.['@angular/core'] || files.includes('angular.json')) {
      return {
        type: 'spa',
        framework: 'Angular',
        buildCmd: 'npm run build',
        distDir: 'dist',
      };
    }
    
    // 8. Svelte projects
    if (dependencies?.['svelte']) {
      return {
        type: 'spa',
        framework: 'Svelte',
        buildCmd: 'npm run build',
        distDir: 'dist',
      };
    }
    
    // 9. Create React App (CRA) - uses 'build' directory
    if (dependencies?.['react-scripts']) {
      return {
        type: 'spa',
        framework: 'React (CRA)',
        buildCmd: 'npm run build',
        distDir: 'build', // CRA uses build directory
      };
    }
    
    // 10. Generic React (without Vite or CRA) - assumes custom setup with 'build'
    if (dependencies?.['react'] && !dependencies?.['next'] && !dependencies?.['gatsby']) {
      return {
        type: 'spa',
        framework: 'React',
        buildCmd: packageJson?.scripts?.build || 'npm run build',
        distDir: 'build', // Fallback to build for generic React
      };
    }
    
    // 11. Generic Vue (without CLI or Nuxt)
    if (dependencies?.['vue'] && !dependencies?.['nuxt']) {
      return {
        type: 'spa',
        framework: 'Vue.js',
        buildCmd: packageJson?.scripts?.build || 'npm run build',
        distDir: 'dist',
      };
    }
    
    // 12. Static site generators (11ty, Jekyll, etc.)
    if (dependencies?.['@11ty/eleventy']) {
      return {
        type: 'static',
        framework: '11ty',
        buildCmd: 'npm run build',
        distDir: '_site',
      };
    }
    
    // 13. Pure static HTML projects (no build process needed)
    if (files.includes('index.html') && !packageJson) {
      return {
        type: 'static',
        framework: 'Static HTML',
        distDir: '.', // Current directory is the build output
      };
    }
    
    // 14. Default fallback - if nothing else matches but has package.json
    if (packageJson) {
      // Check if there's a build script
      const hasBuildScript = packageJson?.scripts?.build;
      
      if (hasBuildScript) {
        return {
          type: 'spa',
          framework: 'Unknown',
          buildCmd: 'npm run build',
          distDir: 'dist', // Safe default for most modern projects
        };
      }
      
      // No build script - might be static or simple Node.js app
      return {
        type: 'static',
        framework: 'Static',
        distDir: '.',
      };
    }
    
    // 15. Ultimate fallback - treat as static HTML
    return {
      type: 'static',
      framework: 'Static HTML',
      distDir: '.',
    };
  }

  private async checkForPattern(workspaceDir: string, pattern: string): Promise<boolean> {
    try {
      const requirementsPath = path.join(workspaceDir, 'requirements.txt');
      const content = await fs.readFile(requirementsPath, 'utf-8');
      return content.toLowerCase().includes(pattern);
    } catch {
      return false;
    }
  }

  private async detectPackageManager(workspaceDir: string): Promise<'npm' | 'yarn' | 'pnpm' | 'bun'> {
    const files = await fs.readdir(workspaceDir);
    
    if (files.includes('bun.lockb')) return 'bun';
    if (files.includes('pnpm-lock.yaml')) return 'pnpm';
    if (files.includes('yarn.lock')) return 'yarn';
    return 'npm';
  }
}
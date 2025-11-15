import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Terminal, 
  Search, 
  Download, 
  Filter, 
  Circle,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Info,
  Clock,
  Loader2 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiClient, queryKeys, DeploymentLog } from '@/lib/api';

interface DeploymentLogsProps {
  deploymentId: string;
  isActive: boolean;
}

export const DeploymentLogs: React.FC<DeploymentLogsProps> = ({
  deploymentId,
  isActive,
}) => {
  const [logs, setLogs] = useState<DeploymentLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<DeploymentLog[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [stepFilter, setStepFilter] = useState<string>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Get initial logs
  const { data: initialLogsData, isLoading } = useQuery({
    queryKey: queryKeys.deploymentLogs(deploymentId),
    queryFn: () => apiClient.getDeploymentLogs(deploymentId),
    refetchInterval: isActive ? 10000 : false, // 10 seconds
  });

  // Get log summary
  const { data: logSummary } = useQuery({
    queryKey: ['deployment-log-summary', deploymentId],
    queryFn: () => apiClient.getDeploymentLogSummary(deploymentId),
    refetchInterval: isActive ? 30000 : false, // 30 seconds
  });

  // Set up SSE connection for real-time logs
  useEffect(() => {
    if (!deploymentId || !isActive) return;

    const eventSource = apiClient.createLogStream(deploymentId);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('Log stream connected');
      setIsConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const logEntry = JSON.parse(event.data);
        
        // Handle different event types
        if (event.type === 'log' && logEntry.deploymentId) {
          setLogs(prevLogs => {
            // Avoid duplicates
            const existingIndex = prevLogs.findIndex(log => log.id === logEntry.id);
            if (existingIndex >= 0) {
              return prevLogs;
            }
            return [...prevLogs, logEntry];
          });
        } else if (event.type === 'heartbeat') {
          // Keep connection alive
          console.log('Heartbeat received');
        }
      } catch (error) {
        console.error('Failed to parse log event:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('Log stream error:', error);
      setIsConnected(false);
    };

    // Handle connection close
    eventSource.addEventListener('error', () => {
      setIsConnected(false);
    });

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [deploymentId, isActive]);

  // Load initial logs
  useEffect(() => {
    if (initialLogsData?.logs) {
      setLogs(initialLogsData.logs);
    }
  }, [initialLogsData]);

  // Filter logs based on search and level
  useEffect(() => {
    let filtered = logs;

    if (searchTerm) {
      filtered = filtered.filter(log =>
        log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.step && log.step.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    if (levelFilter !== 'all') {
      filtered = filtered.filter(log => log.level === levelFilter);
    }

    if (stepFilter !== 'all') {
      filtered = filtered.filter(log => log.step === stepFilter);
    }

    setFilteredLogs(filtered);
  }, [logs, searchTerm, levelFilter, stepFilter]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [filteredLogs, autoScroll]);

  const getLevelIcon = (level: DeploymentLog['level']) => {
    switch (level) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warn':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'info':
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getLevelColor = (level: DeploymentLog['level']) => {
    switch (level) {
      case 'success':
        return 'text-green-700 dark:text-green-300';
      case 'error':
        return 'text-red-700 dark:text-red-300';
      case 'warn':
        return 'text-yellow-700 dark:text-yellow-300';
      case 'info':
      default:
        return 'text-blue-700 dark:text-blue-300';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const downloadLogs = () => {
    const logText = filteredLogs.map(log => 
      `[${formatTimestamp(log.timestamp)}] ${log.level.toUpperCase()}: ${log.message}`
    ).join('\n');
    
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deployment-${deploymentId}-logs.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getUniqueSteps = () => {
    const steps = logs
      .map(log => log.step)
      .filter((step, index, array) => step && array.indexOf(step) === index);
    return steps;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading logs...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              Deployment Logs
              {isActive && (
                <div className="flex items-center gap-2 ml-4">
                  <div className={cn(
                    "h-2 w-2 rounded-full",
                    isConnected ? "bg-green-500" : "bg-red-500"
                  )} />
                  <span className="text-sm text-muted-foreground">
                    {isConnected ? 'Live' : 'Disconnected'}
                  </span>
                </div>
              )}
            </CardTitle>
            <CardDescription>
              {logSummary && (
                <div className="flex items-center gap-4 mt-2">
                  <span className="text-sm">
                    Total: {logSummary.totalLogs} logs
                  </span>
                  {logSummary.errorCount > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      {logSummary.errorCount} errors
                    </Badge>
                  )}
                  {logSummary.warningCount > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {logSummary.warningCount} warnings
                    </Badge>
                  )}
                  {logSummary.duration && (
                    <span className="text-sm text-muted-foreground">
                      Duration: {Math.round(logSummary.duration / 1000)}s
                    </span>
                  )}
                </div>
              )}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAutoScroll(!autoScroll)}
              className={cn(
                "text-xs",
                autoScroll && "bg-primary/10 border-primary/20"
              )}
            >
              Auto-scroll: {autoScroll ? 'On' : 'Off'}
            </Button>
            <Button variant="outline" size="sm" onClick={downloadLogs}>
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 pt-4">
          <div className="flex items-center gap-2 flex-1">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-xs"
            />
          </div>
          
          <Select value={levelFilter} onValueChange={setLevelFilter}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="warn">Warning</SelectItem>
              <SelectItem value="error">Error</SelectItem>
            </SelectContent>
          </Select>

          <Select value={stepFilter} onValueChange={setStepFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Steps</SelectItem>
              {getUniqueSteps().map(step => (
                <SelectItem key={step} value={step!}>
                  {step}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <ScrollArea className="h-[500px] w-full" ref={scrollAreaRef}>
          <div className="p-4 space-y-1 font-mono text-sm">
            {filteredLogs.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                {searchTerm || levelFilter !== 'all' || stepFilter !== 'all' 
                  ? 'No logs match the current filters'
                  : 'No logs available'
                }
              </div>
            ) : (
              filteredLogs.map((log, index) => (
                <div key={log.id || index} className="flex items-start gap-3 py-1 hover:bg-muted/50 rounded px-2">
                  <span className="text-muted-foreground text-xs mt-0.5 shrink-0">
                    {formatTimestamp(log.timestamp)}
                  </span>
                  <div className="shrink-0 mt-0.5">
                    {getLevelIcon(log.level)}
                  </div>
                  {log.step && (
                    <>
                      <Badge variant="outline" className="text-xs shrink-0 mt-0.5">
                        {log.step}
                      </Badge>
                      <span className="text-muted-foreground">•</span>
                    </>
                  )}
                  <span className={cn("flex-1", getLevelColor(log.level))}>
                    {log.message}
                  </span>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
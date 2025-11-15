import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  CheckCircle,
  Clock,
  GitBranch,
  Globe,
  Copy,
  ExternalLink,
  AlertCircle,
  Play,
  Pause,
  RotateCcw,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiClient, queryKeys, DeploymentStatus, LogEvent } from '@/lib/api';
import { toast } from 'sonner';

interface DeployModalProps {
  isOpen: boolean;
  onClose: () => void;
  deploymentId: string;
}

const statusConfig = {
  queued: { icon: Clock, color: 'text-yellow-500', label: 'Queued' },
  cloning: { icon: GitBranch, color: 'text-blue-500', label: 'Cloning Repository' },
  detecting: { icon: Clock, color: 'text-blue-500', label: 'Analyzing Project' },
  building: { icon: Play, color: 'text-blue-500', label: 'Building' },
  deploying: { icon: Globe, color: 'text-blue-500', label: 'Deploying' },
  success: { icon: CheckCircle, color: 'text-green-500', label: 'Deployed Successfully' },
  failed: { icon: AlertCircle, color: 'text-red-500', label: 'Deployment Failed' },
  cancelled: { icon: X, color: 'text-gray-500', label: 'Cancelled' },
};

export function DeployModal({ isOpen, onClose, deploymentId }: DeployModalProps) {
  const [logs, setLogs] = useState<LogEvent[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Fetch deployment status
  const { data: deployment, refetch } = useQuery<DeploymentStatus>({
    queryKey: queryKeys.deployment(deploymentId),
    queryFn: () => apiClient.getDeploymentStatus(deploymentId),
    enabled: isOpen && !!deploymentId,
    refetchInterval: (query) => {
      const data = query.state.data as DeploymentStatus | undefined;
      return data && ['queued', 'cloning', 'detecting', 'building', 'deploying'].includes(data.status) ? 5000 : false;
    },
  });

  // Setup SSE for logs
  useEffect(() => {
    if (!isOpen || !deploymentId || isPaused) return;

    const eventSource = apiClient.createLogStream(deploymentId);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const newLogs = JSON.parse(event.data) as LogEvent[];
        setLogs(prevLogs => {
          const existingIds = new Set(prevLogs.map(log => `${log.timestamp}-${log.message}`));
          const uniqueNewLogs = newLogs.filter(log => !existingIds.has(`${log.timestamp}-${log.message}`));
          return [...prevLogs, ...uniqueNewLogs];
        });
      } catch (error) {
        console.error('Failed to parse log event:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
    };

    return () => {
      eventSource.close();
    };
  }, [isOpen, deploymentId, isPaused]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const handleCopyUrl = async () => {
    if (deployment?.url) {
      try {
        await navigator.clipboard.writeText(deployment.url);
        toast.success('URL copied to clipboard!');
      } catch (error) {
        toast.error('Failed to copy URL');
      }
    }
  };

  const handleCancel = async () => {
    try {
      await apiClient.cancelDeployment(deploymentId);
      toast.success('Deployment cancelled');
      refetch();
    } catch (error) {
      toast.error('Failed to cancel deployment');
    }
  };

  const clearLogs = () => {
    setLogs([]);
  };

  if (!deployment) {
    return null;
  }

  const StatusIcon = statusConfig[deployment.status]?.icon || Clock;
  const statusColor = statusConfig[deployment.status]?.color || 'text-gray-500';
  const statusLabel = statusConfig[deployment.status]?.label || deployment.status;

  const isActive = ['queued', 'cloning', 'detecting', 'building', 'deploying'].includes(deployment.status);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <StatusIcon className={cn('h-5 w-5', statusColor)} />
            Deployment {deploymentId.split('_')[1]}
          </DialogTitle>
          <DialogDescription>
            {statusLabel} • {deployment.provider && `${deployment.provider} • `}
            {new Date(deployment.createdAt).toLocaleString()}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col gap-4 min-h-0">
          {/* Deployment Info */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
            <div>
              <h4 className="font-medium mb-2">Project Details</h4>
              {deployment.analysis && (
                <div className="space-y-1 text-sm text-muted-foreground">
                  <div>Framework: {deployment.analysis.framework}</div>
                  <div>Type: {deployment.analysis.type}</div>
                  <div>Build Command: {deployment.analysis.buildCommand}</div>
                </div>
              )}
            </div>
            <div>
              <h4 className="font-medium mb-2">Status</h4>
              <div className="space-y-2">
                <Badge variant={deployment.status === 'success' ? 'default' : deployment.status === 'failed' ? 'destructive' : 'secondary'}>
                  {statusLabel}
                </Badge>
                {deployment.url && (
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleCopyUrl}>
                      <Copy className="h-3 w-3 mr-1" />
                      Copy URL
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <a href={deployment.url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Open
                      </a>
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Logs Section */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium">Build Logs</h4>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsPaused(!isPaused)}
                  disabled={!isActive}
                >
                  {isPaused ? (
                    <Play className="h-3 w-3 mr-1" />
                  ) : (
                    <Pause className="h-3 w-3 mr-1" />
                  )}
                  {isPaused ? 'Resume' : 'Pause'}
                </Button>
                <Button variant="outline" size="sm" onClick={clearLogs}>
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              </div>
            </div>

            <ScrollArea className="flex-1 border rounded-md p-4 bg-black text-green-400 font-mono text-sm">
              {logs.length === 0 ? (
                <div className="text-muted-foreground">No logs yet...</div>
              ) : (
                <div className="space-y-1">
                  {logs.map((log, index) => (
                    <div key={index} className={cn(
                      'flex gap-2',
                      log.level === 'error' && 'text-red-400',
                      log.level === 'warn' && 'text-yellow-400',
                      log.level === 'info' && 'text-green-400',
                      log.level === 'debug' && 'text-blue-400'
                    )}>
                      <span className="text-xs text-gray-500 shrink-0">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      <span className="text-xs text-gray-400 shrink-0 uppercase">
                        [{log.level}]
                      </span>
                      <span className="break-all">{log.message}</span>
                    </div>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Actions */}
          <div className="flex justify-between items-center pt-2">
            <div className="flex items-center gap-2">
              {deployment.error && (
                <Badge variant="destructive">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  {deployment.error}
                </Badge>
              )}
            </div>
            <div className="flex gap-2">
              {isActive && (
                <Button variant="destructive" onClick={handleCancel}>
                  Cancel Deployment
                </Button>
              )}
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
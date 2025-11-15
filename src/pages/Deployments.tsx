import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle, Clock, GitBranch, Globe, AlertCircle, ExternalLink, Eye, Search, RefreshCw, X, Plus, Settings, Key, Monitor } from 'lucide-react';
import { apiClient, queryKeys, DeploymentStatus } from '@/lib/api';
import { useBlurReveal } from '@/hooks/useBlurReveal';
import { toast } from 'sonner';
import { EnhancedDeployModal } from '@/components/EnhancedDeployModal';
import { CredentialsManager } from '@/components/CredentialsManager';
import { DeploymentLogs } from '@/components/DeploymentLogs';

const statusConfig = {
  queued: { icon: Clock, color: 'text-yellow-500 bg-yellow-100 dark:bg-yellow-900/20', label: 'Queued' },
  cloning: { icon: GitBranch, color: 'text-blue-500 bg-blue-100 dark:bg-blue-900/20', label: 'Cloning' },
  building: { icon: Clock, color: 'text-blue-500 bg-blue-100 dark:bg-blue-900/20', label: 'Building' },
  deploying: { icon: Globe, color: 'text-blue-500 bg-blue-100 dark:bg-blue-900/20', label: 'Deploying' },
  success: { icon: CheckCircle, color: 'text-green-500 bg-green-100 dark:bg-green-900/20', label: 'Success' },
  failed: { icon: AlertCircle, color: 'text-red-500 bg-red-100 dark:bg-red-900/20', label: 'Failed' },
  cancelled: { icon: X, color: 'text-gray-500 bg-gray-100 dark:bg-gray-900/20', label: 'Cancelled' },
};

function DeploymentsPage() {
  useBlurReveal();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('deployments');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedDeployment, setSelectedDeployment] = useState<DeploymentStatus | null>(null);

  const queryClient = useQueryClient();

  // Fetch deployments from API
  const { data: deploymentsData, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.deployments(1),
    queryFn: () => apiClient.getDeployments(),
    refetchInterval: (query) => {
      // Only auto-refresh if there are active deployments
      const data = query.state.data;
      if (data?.deployments) {
        const hasActiveDeployments = data.deployments.some((d: DeploymentStatus) =>
          ['queued', 'cloning', 'building', 'deploying'].includes(d.status)
        );
        return hasActiveDeployments ? 10000 : false; // 10 seconds for active deployments
      }
      return false;
    },
  });

  const deployments = deploymentsData?.deployments || [];

  const filteredDeployments = deployments.filter((deployment: DeploymentStatus) => {
    const matchesSearch = searchTerm === '' ||
      deployment.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      deployment.provider?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      deployment.analysis?.framework?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || deployment.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handleNewDeployment = () => {
    setIsCreateModalOpen(true);
  };

  const handleViewDeployment = (deployment: DeploymentStatus) => {
    setSelectedDeployment(deployment);
  };

  const isDeploymentActive = (status: string) => {
    return ['queued', 'cloning', 'building', 'deploying'].includes(status);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen text-white pb-32 px-4">
        <div className="max-w-7xl mx-auto pt-20">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-8 w-8 animate-spin text-indigo-400" />
            <span className="ml-2 text-xl">Loading deployments...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen text-white pb-32 px-4">
        <div className="max-w-7xl mx-auto pt-20">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-400 mb-4">Error loading deployments</h1>
            <p className="text-gray-400 mb-4">Please make sure the backend is running.</p>
            <Button onClick={() => refetch()} className="bg-indigo-600 hover:bg-indigo-700">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white">
      <div className="container mx-auto py-8 px-4">
        <div className="glass-card rounded-2xl p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-indigo-300 to-purple-300 bg-clip-text text-transparent">
                Deployment Dashboard
              </h1>
              <p className="text-gray-300">
                Deploy, monitor, and manage your applications
              </p>
            </div>
            <Button 
              onClick={handleNewDeployment}
              className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white rounded-full px-6"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Deployment
            </Button>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="glass-card bg-black/20 border-white/10 p-1">
              <TabsTrigger value="deployments" className="data-[state=active]:bg-white/20 data-[state=active]:text-white text-gray-300">
                <Monitor className="h-4 w-4 mr-2" />
                Deployments
              </TabsTrigger>
              <TabsTrigger value="credentials" className="data-[state=active]:bg-white/20 data-[state=active]:text-white text-gray-300">
                <Key className="h-4 w-4 mr-2" />
                Credentials
              </TabsTrigger>
            </TabsList>

            <TabsContent value="deployments" className="space-y-6">
              {/* Filters */}
              <div className="flex items-center gap-4">
                <div className="relative max-w-md flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search deployments..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 glass-card border-white/20 text-white placeholder-gray-400"
                  />
                </div>
                
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40 glass-card border-white/20 text-white">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="success">Success</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="queued">Queued</SelectItem>
                    <SelectItem value="building">Building</SelectItem>
                    <SelectItem value="deploying">Deploying</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  variant="outline"
                  onClick={() => refetch()}
                  className="glass-card border-white/20 text-white hover:bg-white/10"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>

              {/* Deployments Grid */}
              <div className="grid gap-6">
                {filteredDeployments.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="glass-card rounded-xl p-8 max-w-md mx-auto">
                      <Globe className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                      <h3 className="text-xl font-semibold mb-2 text-gray-300">No deployments found</h3>
                      <p className="text-gray-400 mb-4">
                        {searchTerm || statusFilter !== 'all' ? 'Try adjusting your search criteria.' : 'Get started by creating your first deployment.'}
                      </p>
                      <Button 
                        onClick={handleNewDeployment}
                        className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white rounded-full"
                      >
                        Create Deployment
                      </Button>
                    </div>
                  </div>
                ) : (
                  filteredDeployments.map((deployment) => {
                    const StatusIcon = statusConfig[deployment.status]?.icon || Clock;
                    const statusLabel = statusConfig[deployment.status]?.label || deployment.status;
                    const isActive = isDeploymentActive(deployment.status);

                    return (
                      <div key={deployment.id} className="glass-card card-hover rounded-xl p-6">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-4 mb-3">
                              <div className="font-mono text-sm text-gray-300 bg-black/20 px-3 py-1 rounded-full">
                                {deployment.id.slice(0, 8)}
                              </div>
                              <Badge 
                                variant="outline" 
                                className={`gap-1 ${statusConfig[deployment.status]?.color || 'text-gray-500'} border-current/30`}
                              >
                                <StatusIcon className={`h-3 w-3 ${isActive ? 'animate-pulse' : ''}`} />
                                {statusLabel}
                              </Badge>
                              {isActive && (
                                <div className="flex items-center text-sm text-blue-400">
                                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse mr-2"></div>
                                  Live
                                </div>
                              )}
                            </div>
                            
                            <div className="grid md:grid-cols-3 gap-4 mb-4">
                              <div>
                                <div className="text-sm text-gray-400 mb-1">Project</div>
                                <div className="font-medium text-white">
                                  {deployment.analysis?.framework || 'Unknown'}
                                </div>
                                <div className="text-xs text-gray-400">
                                  {deployment.analysis?.type || 'Unknown'} • 
                                  {deployment.analysis?.estimatedSize ? ` ${deployment.analysis.estimatedSize}MB` : ''}
                                </div>
                              </div>
                              
                              <div>
                                <div className="text-sm text-gray-400 mb-1">Provider</div>
                                <Badge variant="secondary" className="bg-white/10 text-white border-white/20">
                                  {deployment.provider || 'auto-selected'}
                                </Badge>
                              </div>
                              
                              <div>
                                <div className="text-sm text-gray-400 mb-1">Deployed</div>
                                <div className="text-sm text-white">
                                  {new Date(deployment.createdAt).toLocaleDateString()} at{' '}
                                  {new Date(deployment.createdAt).toLocaleTimeString([], { 
                                    hour: '2-digit', 
                                    minute: '2-digit' 
                                  })}
                                </div>
                              </div>
                            </div>

                            {deployment.error && (
                              <div className="bg-red-900/20 border border-red-500/20 rounded-lg p-3 mb-4">
                                <div className="text-sm text-red-300">
                                  <strong>Error:</strong> {deployment.error}
                                </div>
                              </div>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewDeployment(deployment)}
                              className="glass-card border-white/20 text-white hover:bg-white/10"
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              View
                            </Button>
                            
                            {deployment.url && (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="glass-card border-white/20 text-white hover:bg-white/10"
                                onClick={() => window.open(deployment.url!, '_blank')}
                              >
                                <ExternalLink className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Stats */}
              {filteredDeployments.length > 0 && (
                <div className="mt-8 text-center text-sm text-gray-400">
                  Showing {filteredDeployments.length} of {deployments.length} deployments
                </div>
              )}
            </TabsContent>

            <TabsContent value="credentials">
              <CredentialsManager />
            </TabsContent>
          </Tabs>
        </div>

        {/* Enhanced Deploy Modal */}
        <EnhancedDeployModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={(deploymentId) => {
            toast.success(`Deployment ${deploymentId} created successfully!`);
            queryClient.invalidateQueries({ queryKey: queryKeys.deployments(1) });
          }}
        />

        {/* Deployment Details Modal */}
        <Dialog open={!!selectedDeployment} onOpenChange={() => setSelectedDeployment(null)}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <Monitor className="h-5 w-5" />
                Deployment Details
                {selectedDeployment && (
                  <Badge className={statusConfig[selectedDeployment.status]?.color}>
                    {statusConfig[selectedDeployment.status]?.label}
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription>
                {selectedDeployment?.id} • {selectedDeployment?.provider}
              </DialogDescription>
            </DialogHeader>

            {selectedDeployment && (
              <div className="space-y-6">
                {/* Deployment Info */}
                <Card>
                  <CardHeader>
                    <CardTitle>Deployment Information</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm font-medium text-muted-foreground mb-1">Status</div>
                      <Badge className={statusConfig[selectedDeployment.status]?.color}>
                        {statusConfig[selectedDeployment.status]?.label}
                      </Badge>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-muted-foreground mb-1">Provider</div>
                      <div>{selectedDeployment.provider}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-muted-foreground mb-1">Framework</div>
                      <div>{selectedDeployment.analysis?.framework || 'Unknown'}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-muted-foreground mb-1">Project Type</div>
                      <div>{selectedDeployment.analysis?.type || 'Unknown'}</div>
                    </div>
                    {selectedDeployment.url && (
                      <div className="col-span-2">
                        <div className="text-sm font-medium text-muted-foreground mb-1">Live URL</div>
                        <div className="flex items-center gap-2">
                          <a 
                            href={selectedDeployment.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:text-blue-600 underline"
                          >
                            {selectedDeployment.url}
                          </a>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(selectedDeployment.url!, '_blank')}
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Real-time Logs */}
                <DeploymentLogs
                  deploymentId={selectedDeployment.id}
                  isActive={isDeploymentActive(selectedDeployment.status)}
                />
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

export default DeploymentsPage;
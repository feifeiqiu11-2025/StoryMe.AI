'use client';

import { GeneratedImage } from '@/lib/types';

interface GenerationProgressProps {
  images: GeneratedImage[];
  totalScenes: number;
}

export default function GenerationProgress({ images, totalScenes }: GenerationProgressProps) {
  const completedCount = images.filter(img => img.status === 'completed').length;
  const failedCount = images.filter(img => img.status === 'failed').length;
  const generatingCount = images.filter(img => img.status === 'generating').length;
  const pendingCount = totalScenes - images.length;

  const progressPercent = Math.round((completedCount / totalScenes) * 100);

  return (
    <div className="w-full bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            Generating Story Images...
          </h3>
          <span className="text-sm font-medium text-gray-600">
            {completedCount} / {totalScenes} completed
          </span>
        </div>

        {/* Overall progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <div
            className="bg-blue-600 h-3 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Individual scene statuses */}
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {images.map((image) => (
            <div
              key={image.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                {image.status === 'completed' && (
                  <span className="text-green-500 text-xl flex-shrink-0">✓</span>
                )}
                {image.status === 'generating' && (
                  <span className="text-blue-500 text-xl flex-shrink-0 animate-spin">⏳</span>
                )}
                {image.status === 'failed' && (
                  <span className="text-red-500 text-xl flex-shrink-0">✗</span>
                )}
                {image.status === 'pending' && (
                  <span className="text-gray-400 text-xl flex-shrink-0">⌛</span>
                )}

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    Scene {image.sceneNumber}: {image.sceneDescription.substring(0, 50)}
                    {image.sceneDescription.length > 50 ? '...' : ''}
                  </p>
                  {image.status === 'completed' && (
                    <p className="text-xs text-gray-500">
                      Generated in {image.generationTime.toFixed(1)}s
                    </p>
                  )}
                  {image.status === 'failed' && image.error && (
                    <p className="text-xs text-red-600">{image.error}</p>
                  )}
                </div>
              </div>

              <div className="flex-shrink-0">
                {image.status === 'generating' && (
                  <div className="w-20 bg-gray-300 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full animate-pulse"
                      style={{ width: '60%' }}
                    />
                  </div>
                )}
                {image.status === 'pending' && (
                  <span className="text-xs text-gray-500 font-medium">Queued</span>
                )}
                {image.status === 'completed' && (
                  <span className="text-xs text-green-600 font-medium">Complete</span>
                )}
                {image.status === 'failed' && (
                  <span className="text-xs text-red-600 font-medium">Failed</span>
                )}
              </div>
            </div>
          ))}

          {/* Pending scenes not yet started */}
          {Array.from({ length: pendingCount }).map((_, index) => (
            <div
              key={`pending-${index}`}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg opacity-60"
            >
              <div className="flex items-center space-x-3">
                <span className="text-gray-400 text-xl">⌛</span>
                <p className="text-sm font-medium text-gray-500">
                  Scene {images.length + index + 1}: Waiting...
                </p>
              </div>
              <span className="text-xs text-gray-400 font-medium">Queued</span>
            </div>
          ))}
        </div>

        {/* Summary stats */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-200 text-sm">
          <div className="text-gray-600">
            {generatingCount > 0 && `Generating ${generatingCount}...`}
            {generatingCount === 0 && completedCount < totalScenes && 'Processing...'}
            {completedCount === totalScenes && failedCount === 0 && 'All done!'}
            {completedCount === totalScenes && failedCount > 0 && `Completed with ${failedCount} error(s)`}
          </div>
          <div className="text-gray-500">
            Estimated time: ~{Math.max(0, (totalScenes - completedCount) * 40)}s
          </div>
        </div>
      </div>
    </div>
  );
}

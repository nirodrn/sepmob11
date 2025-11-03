import React, { useState } from 'react';
import { consolidateDRStock, formatConsolidationReport } from '../../utils/consolidateDRStock';
import { LoadingSpinner } from '../../components/Common/LoadingSpinner';
import { Package, AlertTriangle, CheckCircle } from 'lucide-react';

export function ConsolidateDRStock() {
  const [isConsolidating, setIsConsolidating] = useState(false);
  const [report, setReport] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isComplete, setIsComplete] = useState(false);

  const handleConsolidate = async () => {
    if (!window.confirm('This will consolidate duplicate products in the DR Stock table. Continue?')) {
      return;
    }

    setIsConsolidating(true);
    setError('');
    setReport('');
    setIsComplete(false);

    try {
      const consolidationReport = await consolidateDRStock();
      const formattedReport = formatConsolidationReport(consolidationReport);
      setReport(formattedReport);
      setIsComplete(true);
    } catch (err: any) {
      setError(err.message || 'Failed to consolidate DR stock');
      console.error('Consolidation error:', err);
    } finally {
      setIsConsolidating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center space-x-3 mb-6">
          <Package className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Consolidate DR Stock</h1>
            <p className="text-sm text-gray-500">Merge duplicate product entries</p>
          </div>
        </div>

        {!isConsolidating && !report && (
          <div className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex">
                <AlertTriangle className="w-5 h-5 text-yellow-600 mr-3 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-medium text-yellow-800 mb-2">Important Information</h3>
                  <ul className="text-sm text-yellow-700 space-y-1 list-disc list-inside">
                    <li>This tool will scan all Direct Representative stock entries</li>
                    <li>Products with the same Product ID will be merged into a single entry</li>
                    <li>Quantities will be summed (total, available, and used)</li>
                    <li>The oldest entry will be kept, newer duplicates will be removed</li>
                    <li>Summary tables will be automatically updated</li>
                  </ul>
                </div>
              </div>
            </div>

            <button
              onClick={handleConsolidate}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Start Consolidation
            </button>
          </div>
        )}

        {isConsolidating && (
          <div className="py-12">
            <LoadingSpinner text="Consolidating DR stock data..." />
            <p className="text-center text-sm text-gray-500 mt-4">
              This may take a moment. Please do not close this page.
            </p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex">
              <AlertTriangle className="w-5 h-5 text-red-600 mr-3 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {isComplete && report && (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center">
                <CheckCircle className="w-5 h-5 text-green-600 mr-3" />
                <div>
                  <h3 className="text-sm font-medium text-green-800">Consolidation Complete!</h3>
                  <p className="text-sm text-green-700 mt-1">
                    All duplicate entries have been successfully merged.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <h3 className="text-sm font-medium text-gray-900 mb-3">Consolidation Report</h3>
              <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono overflow-auto max-h-96">
                {report}
              </pre>
            </div>

            <button
              onClick={() => {
                setReport('');
                setIsComplete(false);
              }}
              className="w-full bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors"
            >
              Run Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

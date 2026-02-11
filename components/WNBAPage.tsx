import React, { useState } from 'react';
import { WNBARosterSelector } from '../components/WNBARosterSelector';
import { Athlete, TeamMetadata, SubscriptionTier } from '../types';

interface WNBAPageProps {
  subscriptionTier?: SubscriptionTier;
}

/**
 * WNBA Historical Rosters Page
 * 
 * This page demonstrates how to integrate the WNBA roster selector
 * into your application. Users can browse historical WNBA rosters
 * and export them in various formats.
 */
export function WNBAPage({ subscriptionTier = 'BASIC' }: WNBAPageProps) {
  const [selectedRoster, setSelectedRoster] = useState<{
    athletes: Athlete[];
    teamName: string;
    metadata: TeamMetadata;
  } | null>(null);

  const handleRosterSelect = (athletes: Athlete[], teamName: string, metadata: TeamMetadata) => {
    setSelectedRoster({ athletes, teamName, metadata });
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Page Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                WNBA Historical Rosters
              </h1>
              <p className="mt-2 text-gray-600">
                Browse and export WNBA team rosters from 1997 to present day
              </p>
            </div>
            <div className="hidden md:block">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-pink-100 text-pink-800">
                {subscriptionTier} Plan
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Roster Selector */}
          <div className="lg:col-span-2">
            <WNBARosterSelector 
              subscriptionTier={subscriptionTier}
              onRosterSelect={handleRosterSelect}
            />
          </div>

          {/* Right Column - Info Panel */}
          <div className="space-y-6">
            {/* About WNBA Data */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                About This Data
              </h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✓</span>
                  <span>All 26 WNBA teams (active & historical)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✓</span>
                  <span>Complete rosters from 1997 season onward</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✓</span>
                  <span>Player jersey numbers included</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✓</span>
                  <span>Positions (G, F, C) documented</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✓</span>
                  <span>Export to all supported formats</span>
                </li>
              </ul>
            </div>

            {/* Export Formats Info */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Available Export Formats
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">CSV (Flat)</span>
                  <span className="text-xs bg-gray-100 px-2 py-1 rounded">BASIC</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Iconik JSON</span>
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">PRO</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">CatDV JSON</span>
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">PRO</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Ross XML</span>
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">PRO</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Chyron CSV</span>
                  <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">STUDIO</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Vizrt XML</span>
                  <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">NETWORK</span>
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            {selectedRoster && (
              <div className="bg-gradient-to-br from-pink-500 to-purple-600 rounded-lg shadow-md p-6 text-white">
                <h3 className="text-lg font-semibold mb-3">
                  Selected Roster
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-pink-100">Team:</span>
                    <span className="font-medium">{selectedRoster.teamName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-pink-100">Players:</span>
                    <span className="font-medium">{selectedRoster.athletes.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-pink-100">Season:</span>
                    <span className="font-medium">{selectedRoster.athletes[0]?.seasonYear || 'N/A'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Help */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-blue-900 mb-2">
                Need Help?
              </h4>
              <p className="text-sm text-blue-800">
                Historical data availability varies by team and season. 
                Some early seasons may have incomplete rosters. Contact 
                support if you need specific data added.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WNBAPage;

import React from 'react';
import { AppSettings } from '../types';
import { SettingsIcon, CloseIcon } from './Icons';

interface SettingsPanelProps {
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  onSave: () => void;
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  settings,
  setSettings,
  onSave,
  isOpen,
  onClose
}) => {
  return (
    <>
      {/* Backdrop for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-20 md:hidden" 
          onClick={onClose}
        />
      )}
      
      <div 
        className={`absolute md:relative inset-y-0 left-0 w-80 bg-white border-r shadow-xl md:shadow-none z-30 flex flex-col transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:hidden md:w-0 md:border-none'
        }`}
      >
        <div className="p-6 border-b flex justify-between items-center bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-blue-600" /> Configuration
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors">
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 flex-1 overflow-y-auto space-y-6">
          <div className="bg-blue-50 text-blue-800 p-4 rounded-lg text-sm border border-blue-100">
            Review the Vertex AI datastore configuration below.
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Google Cloud Project ID
            </label>
            <input
              type="text"
              value={settings.projectId}
              readOnly
              className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-100 text-gray-500 outline-none cursor-not-allowed"
            />
            <p className="text-xs text-gray-500">Pre-configured for this application.</p>
          </div>
          
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Location</label>
            <input
              type="text"
              value={settings.location}
              onChange={e => setSettings(s => ({ ...s, location: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            />
          </div>
          
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Datastore ID</label>
            <input
              type="text"
              value={settings.datastoreId}
              readOnly
              className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-100 text-gray-500 outline-none cursor-not-allowed"
            />
            <p className="text-xs text-gray-500">Pre-configured for this application.</p>
          </div>
        </div>
        
        <div className="p-6 border-t bg-gray-50">
          <button
            onClick={onSave}
            disabled={!settings.projectId.trim()}
            className="w-full py-2.5 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            Connect Agent
          </button>
        </div>
      </div>
    </>
  );
};

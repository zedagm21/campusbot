import React from 'react';

export default function GradeTabs({ activeTab, onTabChange }) {
    return (
        <div className="flex border-b border-gray-200 dark:border-gray-700 mb-4">
            <button
                className={`flex-1 py-3 px-4 text-center font-medium text-sm focus:outline-none transition-colors duration-200 cursor-pointer ${activeTab === 'chat'
                    ? 'text-teal-600 dark:text-teal-400 border-b-2 border-teal-600 dark:border-teal-400 bg-teal-50 dark:bg-teal-900/30'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                onClick={() => onTabChange('chat')}
            >
                💬 Chat Assistant
            </button>
            <button
                className={`flex-1 py-3 px-4 text-center font-medium text-sm focus:outline-none transition-colors duration-200 cursor-pointer ${activeTab === 'history'
                    ? 'text-teal-600 dark:text-teal-400 border-b-2 border-teal-600 dark:border-teal-400 bg-teal-50 dark:bg-teal-900/30'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                onClick={() => onTabChange('history')}
            >
                📊 Grade History
            </button>
        </div>
    );
}

import { useState, useEffect } from "react";

export default function GradeHistorySection({ gradeHistory, onLoadHistory, isCollapsed }) {
    if (isCollapsed) {
        return (
            <div className="p-2">
                <button
                    className="w-full p-2 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                    title="Grade History"
                >
                    <svg className="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                    </svg>
                </button>
            </div>
        );
    }

    return (
        <div className="border-t border-gray-200 dark:border-gray-700">
            <div className="p-4 bg-gray-50 dark:bg-gray-800">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                    📊 Grade History
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                    Quick access to your saved grade queries
                </p>

                {gradeHistory.length === 0 ? (
                    <div className="text-xs text-gray-400 dark:text-gray-500 italic text-center py-4">
                        No grade history yet. Query your grades to see them here!
                    </div>
                ) : (
                    <div className="space-y-2">
                        {gradeHistory.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => onLoadHistory(item)}
                                className="w-full text-left p-2 rounded-md bg-white dark:bg-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 border border-gray-200 dark:border-gray-600 transition-colors group cursor-pointer"
                            >
                                <div className="flex items-start gap-2">
                                    <svg
                                        className="w-4 h-4 text-blue-500 dark:text-blue-400 mt-0.5 flex-shrink-0"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                        />
                                    </svg>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">
                                            {item.title}
                                        </p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {new Date(item.timestamp).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

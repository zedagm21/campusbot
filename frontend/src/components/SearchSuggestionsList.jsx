import React from 'react';

export default function SearchSuggestionsList({ isVisible, onSelectSuggestion }) {
    if (!isVisible) return null;

    const suggestions = [
        {
            category: 'Grade & Course Queries',
            items: [
                'What is my current CGPA?',
                'Show me the breakdown for Year 3, Semester 2',
                'What was my grade in Object Oriented Programming?',
                'What is my latest GPA?',
                'Show me all my Year 4 results',
            ],
        },
        {
            category: 'General Queries',
            items: [
                'How do I register for courses?',
                'What is the academic calendar for this year?',
                'How do I reset my portal password?',
                'When is the registration deadline?',
            ],
        },
    ];

    return (
        <div className="mt-2 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-y-auto" style={{ maxHeight: 'inherit' }}>
            {suggestions.map((section, sectionIdx) => (
                <div key={sectionIdx} className="py-2">
                    <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        {section.category}
                    </div>
                    {section.items.map((item, itemIdx) => (
                        <button
                            key={itemIdx}
                            onMouseDown={(e) => {
                                e.preventDefault(); // Prevent blur from firing before click
                                onSelectSuggestion(item);
                            }}
                            className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors flex items-center gap-2 cursor-pointer"
                        >
                            <svg
                                className="w-4 h-4 text-gray-400 dark:text-gray-500"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                            </svg>
                            <span>{item}</span>
                        </button>
                    ))}
                </div>
            ))}
        </div>
    );
}

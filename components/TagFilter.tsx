
import React from 'react';

interface TagFilterProps {
  tags: string[];
  selectedTag: string | null;
  onSelectTag: (tag: string | null) => void;
}

const TagFilter: React.FC<TagFilterProps> = ({ tags, selectedTag, onSelectTag }) => {
    if (tags.length === 0) {
        return null;
    }

  return (
    <div className="bg-gray-800/50 p-3 rounded-xl">
      <div className="flex items-center space-x-3 overflow-x-auto pb-2 -mb-2">
        <span className="text-sm font-semibold text-gray-400 flex-shrink-0 pr-2">Filter by Tag:</span>
        <button
          onClick={() => onSelectTag(null)}
          className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
            selectedTag === null
              ? 'bg-cyan-500 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          All
        </button>
        {tags.map((tag) => (
          <button
            key={tag}
            onClick={() => onSelectTag(tag)}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors flex-shrink-0 ${
              selectedTag === tag
                ? 'bg-cyan-500 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {tag}
          </button>
        ))}
      </div>
    </div>
  );
};

export default TagFilter;

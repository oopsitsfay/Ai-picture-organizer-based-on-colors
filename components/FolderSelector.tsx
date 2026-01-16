import React, { useState } from 'react';
import { FolderIcon } from './icons';

interface FolderSelectorProps {
  onFilesFound: (files: File[]) => void;
  disabled: boolean;
  setLoadingMessage: (message: string) => void;
}

const FolderSelector: React.FC<FolderSelectorProps> = ({ onFilesFound, disabled, setLoadingMessage }) => {
  const [error, setError] = useState<string | null>(null);
  const [folderName, setFolderName] = useState<string | null>(null);

  const handleFolderSelect = async () => {
    setError(null);
    setFolderName(null);

    if (!('showDirectoryPicker' in window)) {
      setError('Your browser does not support direct folder access. Please use a modern browser like Chrome or Edge.');
      return;
    }

    try {
      // FIX: Cast window to `any` to call `showDirectoryPicker`, as it may not be in the default TS Window type definitions.
      const dirHandle = await (window as any).showDirectoryPicker();
      setFolderName(dirHandle.name);
      setLoadingMessage(`Scanning folder "${dirHandle.name}"...`);

      const files = await getFilesInDirectory(dirHandle);
      onFilesFound(files);

    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('Error selecting folder:', err);
        setError('Could not access the folder. Please try again.');
      }
    }
  };
  
  async function getFilesInDirectory(dirHandle: FileSystemDirectoryHandle): Promise<File[]> {
    const files: File[] = [];
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp'];

    for await (const entry of dirHandle.values()) {
      if (entry.kind === 'file') {
        if (imageExtensions.some(ext => entry.name.toLowerCase().endsWith(ext))) {
          // FIX: Cast `entry` to `FileSystemFileHandle` to access the `getFile` method.
          const file = await (entry as FileSystemFileHandle).getFile();
          files.push(file);
        }
      } else if (entry.kind === 'directory') {
        // Recursively get files from subdirectories
        // FIX: Cast `entry` to `FileSystemDirectoryHandle` for the recursive call.
        const subFiles = await getFilesInDirectory(entry as FileSystemDirectoryHandle);
        files.push(...subFiles);
      }
    }
    return files;
  }

  return (
    <div className="bg-gray-800/50 p-6 rounded-xl text-center">
      <button
        onClick={handleFolderSelect}
        disabled={disabled}
        className="w-full border-2 border-dashed rounded-xl p-8 sm:p-12 text-center transition-all duration-300 border-gray-600 hover:border-cyan-500 hover:bg-gray-700/50 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <div className="flex flex-col items-center justify-center space-y-4">
          <FolderIcon />
          <p className="text-lg font-semibold text-gray-200">
            Select a Picture Folder to Organize
          </p>
          <p className="text-sm text-gray-500">The app will scan the folder and any subfolders for images.</p>
        </div>
      </button>
      {folderName && !disabled && (
        <p className="mt-4 text-sm text-gray-400">Selected folder: <span className="font-semibold text-cyan-400">{folderName}</span></p>
      )}
      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
    </div>
  );
};

export default FolderSelector;
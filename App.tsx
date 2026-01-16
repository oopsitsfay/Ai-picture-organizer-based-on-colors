
import React, { useState, useMemo, useCallback } from 'react';
import { ImageFile } from './types';
import * as geminiService from './services/geminiService';
import FolderSelector from './components/FolderSelector';
import ImageGallery from './components/ImageGallery';
import ColorPalette from './components/ColorPalette';
import TagFilter from './components/TagFilter';
import Loader from './components/Loader';
import { GithubIcon } from './components/icons';

export default function App(): React.JSX.Element {
  const [images, setImages] = useState<ImageFile[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [colorPalette, setColorPalette] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const handleFilesFound = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    setIsLoading(true);
    setError(null);

    const processFile = async (file: File): Promise<ImageFile | null> => {
      try {
        setLoadingMessage(`Analyzing ${file.name}...`);
        const { colors, tags } = await geminiService.analyzeImage(file);
        const id = self.crypto.randomUUID();
        const url = URL.createObjectURL(file);
        return { id, file, url, colors, tags };
      } catch (err) {
        console.error(`Failed to process file ${file.name}:`, err);
        return null;
      }
    };

    // Process files in chunks to avoid overwhelming the API
    const newImages: ImageFile[] = [];
    const failedFiles: string[] = [];
    for (const file of files) {
      const result = await processFile(file);
      if (result) {
        newImages.push(result);
      } else {
        failedFiles.push(file.name);
      }
    }
    
    if (failedFiles.length > 0) {
      setError(`Could not process ${failedFiles.length} image(s). Check console and API key.`);
    }

    setImages(prev => {
      const allImages = [...prev, ...newImages];
      return allImages.filter((v, i, a) => a.findIndex(v2 => v2.file.name === v.file.name && v2.file.size === v.file.size) === i);
    });

    setColorPalette(prevPalette => {
      const allColors = newImages.flatMap(img => img.colors);
      const uniqueColors = [...new Set([...prevPalette, ...allColors])];
      return uniqueColors.sort();
    });

    setAllTags(prevTags => {
      const allNewTags = newImages.flatMap(img => img.tags);
      const uniqueTags = [...new Set([...prevTags, ...allNewTags])];
      return uniqueTags.sort();
    });

    setIsLoading(false);
    setLoadingMessage('');
  }, []);

  const filteredImages = useMemo(() => {
    let result = images;
    if (selectedColor) {
      result = result.filter(image => image.colors.includes(selectedColor));
    }
    if (selectedTag) {
      result = result.filter(image => image.tags.includes(selectedTag));
    }
    return result;
  }, [images, selectedColor, selectedTag]);

  const handleClear = () => {
    images.forEach(image => URL.revokeObjectURL(image.url));
    setImages([]);
    setColorPalette([]);
    setAllTags([]);
    setSelectedColor(null);
    setSelectedTag(null);
    setError(null);
  };

  const handleSelectColor = (color: string | null) => {
    setSelectedColor(color);
    setSelectedTag(null); // Deselect tag when color is selected
  }

  const handleSelectTag = (tag: string | null) => {
    setSelectedTag(tag);
    setSelectedColor(null); // Deselect color when tag is selected
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans">
      {isLoading && <Loader message={loadingMessage} />}
      <header className="bg-gray-800/50 backdrop-blur-sm p-4 border-b border-gray-700 sticky top-0 z-10 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">
          <span className="text-cyan-400">Chroma</span>Sort
        </h1>
        <a href="https://github.com/google/genai-js" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">
          <GithubIcon />
        </a>
      </header>

      <main className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-2">AI-Powered Picture Organizer</h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Select a local folder and let Gemini API extract dominant colors and tags to organize your pictures instantly.
          </p>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg relative mb-6" role="alert">
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        <FolderSelector onFilesFound={handleFilesFound} disabled={isLoading} setLoadingMessage={setLoadingMessage} />

        {images.length > 0 && (
          <div className="mt-10 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
               <h3 className="text-2xl font-bold text-white">Filter Your Gallery</h3>
              <button
                onClick={handleClear}
                className="px-4 py-2 bg-red-600/80 hover:bg-red-600 text-white rounded-lg transition-colors text-sm font-semibold"
              >
                Clear All
              </button>
            </div>
             <ColorPalette
              colors={colorPalette}
              selectedColor={selectedColor}
              onSelectColor={handleSelectColor}
            />
            <TagFilter
              tags={allTags}
              selectedTag={selectedTag}
              onSelectTag={handleSelectTag}
            />
          </div>
        )}

        <div className="mt-8">
          <ImageGallery images={filteredImages} />
          {images.length > 0 && filteredImages.length === 0 && (
            <div className="text-center py-16 px-6 bg-gray-800/50 rounded-lg">
              <p className="text-gray-400">No images match the selected filter.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

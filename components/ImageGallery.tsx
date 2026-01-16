
import React from 'react';
import { ImageFile } from '../types';

interface ImageGalleryProps {
  images: ImageFile[];
}

const ImageGallery: React.FC<ImageGalleryProps> = ({ images }) => {
  if (images.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {images.map((image) => (
        <div key={image.id} className="group relative overflow-hidden rounded-lg bg-gray-800 shadow-lg aspect-square">
          <img
            src={image.url}
            alt={image.file.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-2.5">
            <div className="flex flex-wrap justify-center gap-1.5 mb-2">
              {image.tags.map((tag) => (
                <span key={tag} className="px-2 py-0.5 bg-gray-900/70 text-gray-200 text-xs rounded-full backdrop-blur-sm">
                  {tag}
                </span>
              ))}
            </div>
            <div className="flex justify-center space-x-1.5">
              {image.colors.map((color, index) => (
                <div
                  key={`${image.id}-${color}-${index}`}
                  className="w-5 h-5 rounded-full border-2 border-white/50 shadow-md"
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ImageGallery;

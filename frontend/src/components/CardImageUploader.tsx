import { Image, Trash } from '@phosphor-icons/react';
import type { FlashcardAsset } from '../types';

interface Props {
  assets: FlashcardAsset[];
  disabled?: boolean;
  onUpload: (file: File) => void;
  onDelete: (assetId: string) => void;
}

export default function CardImageUploader({ assets, disabled, onUpload, onDelete }: Props) {
  return (
    <div>
      <label className="block mb-2" style={{ color: 'var(--text-secondary)', fontSize: '0.84rem' }}>Images</label>
      <label
        className="flex items-center justify-center gap-2 px-3 py-3 cursor-pointer"
        style={{ background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: '12px', color: 'var(--text-secondary)' }}
      >
        <Image size={18} />
        Upload image
        <input
          type="file"
          accept="image/*"
          hidden
          disabled={disabled}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              onUpload(file);
              event.currentTarget.value = '';
            }
          }}
        />
      </label>
      {assets.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mt-3">
          {assets.map((asset) => (
            <div key={asset.id} className="p-2" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px' }}>
              <img src={asset.content_url} alt={asset.original_filename || 'Flashcard asset'} className="w-full h-28 object-cover rounded-lg mb-2" />
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs" style={{ color: 'var(--text-secondary)' }}>{asset.original_filename || 'Image'}</span>
                <button type="button" onClick={() => onDelete(asset.id)} style={{ color: 'var(--danger)' }}>
                  <Trash size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

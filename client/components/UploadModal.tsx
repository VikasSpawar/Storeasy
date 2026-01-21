'use client';

import { useState, ChangeEvent, useEffect } from 'react';
import { X, UploadCloud, Loader2 } from 'lucide-react';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete: () => void;
  userId: string; 
  initialFile?: File | null;
  folderId: string | null;
}

export default function UploadModal({ isOpen, onClose, onUploadComplete, userId, initialFile, folderId}: UploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState('');

// This runs whenever the modal opens or the initialFile changes
  useEffect(() => {
    if (isOpen && initialFile) {
      setFile(initialFile);
    }
  }, [isOpen, initialFile]);


  if (!isOpen) return null;

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setStatus('Preparing secure link...');

    try {
      // 1. Get Signed URL
      const signRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/upload/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
          userId: userId
        })
      });

      const { signedUrl, path, error: signError } = await signRes.json();
      if (signError) throw new Error(signError);

      // 2. Upload to Storage
      setStatus('Uploading to cloud...');
      const uploadRes = await fetch(signedUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });

      if (!uploadRes.ok) throw new Error('Upload failed');

      // 3. Save to DB
      setStatus('Finalizing...');
      const completeRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/upload/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId,
          fileName: file.name,
          filePath: path,
          fileSize: file.size,
          fileType: file.type,
          folderId: folderId
        })
      });

      const { error: dbError } = await completeRes.json();
      if (dbError) throw new Error(dbError);

      // Success!
      setFile(null);
      setStatus('');
      setUploading(false);
      onUploadComplete();
      onClose();

    } catch (err: any) {
      console.error(err);
      setStatus('Error: ' + err.message);
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 w-full max-w-md rounded-2xl p-6 shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white">
          <X size={20} />
        </button>

        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
          <UploadCloud className="text-blue-500" />
          Upload Media
        </h2>

        <div className="border-2 border-dashed border-gray-700 hover:border-blue-500 rounded-xl p-8 flex flex-col items-center justify-center transition-colors bg-gray-950/50">
          <input 
            type="file" 
            onChange={handleFileChange}
            className="hidden" 
            id="file-upload"
          />
          <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center text-center">
            <UploadCloud size={40} className="text-gray-600 mb-4" />
            <span className="text-sm text-gray-300 font-medium">
              {file ? file.name : "Click to select a file"}
            </span>
          </label>
        </div>

        {status && <p className="text-xs text-blue-400 mt-4 text-center font-mono">{status}</p>}

        <button 
          onClick={handleUpload}
          disabled={!file || uploading}
          className={`w-full mt-6 py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all ${
            !file || uploading 
              ? 'bg-gray-800 text-gray-500 cursor-not-allowed' 
              : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20'
          }`}
        >
          {uploading && <Loader2 className="animate-spin" size={18} />}
          {uploading ? 'Uploading...' : 'Upload Now'}
        </button>
      </div>
    </div>
  );
}
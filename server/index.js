require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Initialize Supabase Admin Client (Service Role)
// This has "God Mode" (bypasses RLS), so we keep it strictly on the server.
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// 0. Health Check
app.get('/', (req, res) => {
  res.send('Storeasy API is running...');
});

//1. Updated Standard Files Route (Supports Shared Folders)
// Example: The route that handles fetching files (including shared ones)
app.get('/api/files', async (req, res) => {
  try {
    const { userId, folderId, filter, email } = req.query; // Ensure 'email' is passed from frontend

    let query = supabase.from('files').select('*');

    if (filter === 'shared') {
        // 1. Find IDs of files shared with this user's email
        const { data: shares } = await supabase
            .from('shares')
            .select('resource_id')
            .eq('grantee_email', email);
        
        const sharedIds = shares.map(s => s.resource_id);
        
        if (sharedIds.length === 0) return res.json([]);

        // 2. Fetch the actual file metadata
        query = query.in('id', sharedIds);
    } else {
        // Standard "My Files" logic
        query = query.eq('owner_id', userId).eq('is_deleted', filter === 'trash');
        if (folderId) query = query.eq('folder_id', folderId);
        else query = query.is('folder_id', null);
    }

    const { data: files, error } = await query;
    if (error) throw error;

    // --- THE FIX: GENERATE SIGNED URLS ---
    // We map over the files and generate a temporary access link for each
    const filesWithUrls = await Promise.all(files.map(async (file) => {
        // Generate a URL valid for 1 hour (3600 seconds)
        const { data } = await supabase.storage
            .from('user-data')
            .createSignedUrl(file.storage_key, 3600);

        return {
            ...file,
            publicUrl: data?.signedUrl || null // Send this to the frontend
        };
    }));

    res.json(filesWithUrls);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 2. The Signing Route (Phase 1.2)
app.post('/api/upload/sign', async (req, res) => {
  try {
    const { fileName, fileType, userId } = req.body;
    
    // Create a clean file path: "user_id/timestamp_filename"
    // The timestamp prevents overwriting files with the same name
    const filePath = `${userId}/${Date.now()}_${fileName}`;

    // Generate a secure upload URL from Supabase
    const { data, error } = await supabase
      .storage
      .from('user-data')
      .createSignedUploadUrl(filePath);

    if (error) throw error;

    // Send the URL and the final Path back to frontend
    res.json({ 
      signedUrl: data.signedUrl, 
      path: data.path, // We need this path later to save to the Database
      token: data.token
    });

  } catch (err) {
    console.error('Upload Sign Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 3. The Completion Route (Updated for Folders)
app.post('/api/upload/complete', async (req, res) => {
  try {
    // Add folderId to the extraction
    const { userId, fileName, filePath, fileSize, fileType, folderId } = req.body;

    const { data, error } = await supabase
      .from('files')
      .insert([
        {
          owner_id: userId,
          name: fileName,
          storage_key: filePath,
          mime_type: fileType,
          size_bytes: fileSize,
          folder_id: folderId || null, // <--- SAVE THE LINK
          metadata: { status: "uploaded" } 
        }
      ])
      .select();

    if (error) throw error;

    res.json({ success: true, file: data[0] });

  } catch (err) {
    console.error('Upload Complete Error:', err);
    res.status(500).json({ error: err.message });
  }
});



// 4. Soft Delete (Role-Aware: Owners & Editors)
app.post('/api/files/delete', async (req, res) => {
  try {
    const { fileId, userId, email } = req.body; // <--- Require email for permission check

    // 1. Fetch File Metadata to check Owner
    const { data: file, error: fetchError } = await supabase
      .from('files')
      .select('owner_id')
      .eq('id', fileId)
      .single();

    if (fetchError || !file) return res.status(404).json({ error: 'File not found' });

    // 2. Determine Permission
    let canDelete = false;

    if (file.owner_id === userId) {
      // User is Owner -> Allow
      canDelete = true;
    } else {
      // User is NOT Owner -> Check if they are an Editor
      const { data: share } = await supabase
        .from('shares')
        .select('role')
        .eq('resource_id', fileId)
        .eq('grantee_email', email) // Check against user's email
        .single();

      if (share && share.role === 'editor') {
        canDelete = true;
      }
    }

    // 3. Block Viewers (or random users)
    if (!canDelete) {
      return res.status(403).json({ error: 'Access Denied: Viewers cannot delete files.' });
    }

    // 4. Execute Soft Delete
    const { error: updateError } = await supabase
      .from('files')
      .update({ is_deleted: true })
      .eq('id', fileId);

    if (updateError) throw updateError;

    res.json({ success: true });

  } catch (err) {
    console.error("Delete Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// 5. Generate Share Link Route
app.post('/api/files/share', async (req, res) => {
  try {
    const { userId, storageKey } = req.body;

    // 1. Verify Ownership (Security)
    // Ensure the user actually owns the file they are trying to share
    const { data: file } = await supabase
      .from('files')
      .select('id')
      .eq('owner_id', userId)
      .eq('storage_key', storageKey)
      .single();

    if (!file) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // 2. Generate Signed URL (Valid for 7 days = 604800 seconds)
    const { data, error } = await supabase
      .storage
      .from('user-data')
      .createSignedUrl(storageKey, 604800);

    if (error) throw error;

    res.json({ signedUrl: data.signedUrl });

  } catch (err) {
    console.error('Share Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 6. Toggle Star Route
app.post('/api/files/toggle-star', async (req, res) => {
  try {
    const { fileId, userId } = req.body;

    // 1. Get current status
    const { data: file } = await supabase
      .from('files')
      .select('is_starred')
      .eq('id', fileId)
      .eq('owner_id', userId)
      .single();

    if (!file) return res.status(404).json({ error: 'File not found' });

    // 2. Flip the boolean
    const { error } = await supabase
      .from('files')
      .update({ is_starred: !file.is_starred })
      .eq('id', fileId);

    if (error) throw error;

    res.json({ success: true, is_starred: !file.is_starred });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Rename File Route
app.post('/api/files/rename', async (req, res) => {
  try {
    const { fileId, userId, newName } = req.body;

    if (!newName || newName.trim() === "") {
      return res.status(400).json({ error: 'Name cannot be empty' });
    }

    // 1. Update the name in the Database
    const { data, error } = await supabase
      .from('files')
      .update({ name: newName })
      .eq('id', fileId)
      .eq('owner_id', userId) // Security check
      .select();

    if (error) throw error;

    res.json({ success: true, file: data[0] });

  } catch (err) {
    console.error('Rename Error:', err);
    res.status(500).json({ error: err.message });
  }
});


// 8. Unified Restore Route (Files AND Folders)
app.post('/api/restore', async (req, res) => {
  try {
    // We now accept 'resourceId' and 'resourceType'
    const { userId, resourceId, resourceType } = req.body; 

    // Decide which table to update based on type
    const table = resourceType === 'folder' ? 'folders' : 'files';

    const { data, error } = await supabase
      .from(table)
      .update({ is_deleted: false })
      .eq('id', resourceId)
      .eq('owner_id', userId)
      .select();

    if (error) throw error;
    res.json({ success: true, item: data[0] });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Create Folder Route
app.post('/api/folders', async (req, res) => {
  try {
    const { name, parentId, userId } = req.body;

    // Optional: Check if parent folder exists and belongs to user
    if (parentId) {
      const { data: parent } = await supabase
        .from('folders')
        .select('id')
        .eq('id', parentId)
        .eq('owner_id', userId)
        .single();
      
      if (!parent) return res.status(403).json({ error: 'Parent folder not found or access denied' });
    }

    const { data, error } = await supabase
      .from('folders')
      .insert([{
        name, 
        parent_id: parentId || null, // Null means Root folder
        owner_id: userId
      }])
      .select();

    if (error) throw error;
    res.json({ success: true, folder: data[0] });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 10. Get Folders (Filter by Parent)
app.get('/api/folders', async (req, res) => {
  try {
    const { userId, parentId } = req.query;

    let query = supabase
      .from('folders')
      .select('*')
      .eq('owner_id', userId)
      .order('name', { ascending: true });

    // If parentId is 'null' string or undefined, we look for root folders
    if (!parentId || parentId === 'null') {
      query = query.is('parent_id', null);
    } else {
      query = query.eq('parent_id', parentId);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 11. Share Resource (Invite User)
app.post('/api/shares', async (req, res) => {
  try {
    const { resourceId, resourceType, email, role, ownerId } = req.body;

    // 1. Validation
    if (!email || !role) return res.status(400).json({ error: 'Missing fields' });

    // 2. Add to Shares Table
    // Note: In a real app, you might check if the 'email' actually belongs to a registered user first.
    // For MVP, we just trust the email so they see it when they eventually sign up/login.
    const { data, error } = await supabase
      .from('shares')
      .insert([{
        resource_id: resourceId,
        resource_type: resourceType,
        grantee_email: email,
        role: role,
        owner_id: ownerId
      }])
      .select();

    if (error) {
      // Handle "Unique Violation" (Already shared)
      if (error.code === '23505') {
        return res.status(400).json({ error: 'User already has access' });
      }
      throw error;
    }

    res.json({ success: true, share: data[0] });

  } catch (err) {
    console.error('Share Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 12. Get "Shared With Me" (Files AND Folders)
// Route: Get items shared with me
app.get('/api/shared-with-me', async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) return res.json({ files: [], folders: [] });

    // 1. Get Shared Records
    const { data: shares } = await supabase
      .from('shares')
      .select('resource_id, role, resource_type') // resource_type is helpful here
      .eq('grantee_email', email);

    if (!shares || shares.length === 0) return res.json({ files: [], folders: [] });

    const fileIds = shares.filter(s => s.resource_type === 'file').map(s => s.resource_id);
    const folderIds = shares.filter(s => s.resource_type === 'folder').map(s => s.resource_id);

    // 2. Fetch Folders (Metadata only)
    let folders = [];
    if (folderIds.length > 0) {
        const { data } = await supabase.from('folders').select('*').in('id', folderIds);
        // Map role to folder
        folders = data.map(f => {
            const share = shares.find(s => s.resource_id === f.id);
            return { ...f, role: share?.role || 'viewer' };
        });
    }

    // 3. Fetch Files & SIGN URLs
    let files = [];
    if (fileIds.length > 0) {
        const { data } = await supabase.from('files').select('*').in('id', fileIds);
        
        // --- CRITICAL: GENERATE SIGNED URLS HERE ---
        files = await Promise.all(data.map(async (f) => {
            const share = shares.find(s => s.resource_id === f.id);
            
            // Backend creates a 1-hour access token
            const { data: signedData } = await supabase.storage
                .from('user-data')
                .createSignedUrl(f.storage_key, 3600);

            return {
                ...f,
                role: share?.role || 'viewer',
                publicUrl: signedData?.signedUrl || null // Send to frontend
            };
        }));
    }

    res.json({ files, folders });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});


// 13. Move File or Folder
app.patch('/api/files/move', async (req, res) => {
  try {
    const { userId, fileId, destinationFolderId } = req.body;

    // 1. Verify Ownership & Update
    const { data, error } = await supabase
      .from('files')
      .update({ folder_id: destinationFolderId || null }) // null = Root
      .eq('id', fileId)
      .eq('owner_id', userId)
      .select();

    if (error) throw error;

    res.json({ success: true, file: data[0] });

  } catch (err) {
    console.error('Move Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 14. Rename File (Secure: Owner OR Editor)
app.patch('/api/files/rename', async (req, res) => {
  try {
    const { fileId, userId, newName, email } = req.body; // <--- Require email

    // 1. Check Permissions
    const { data: file } = await supabase.from('files').select('owner_id').eq('id', fileId).single();
    
    if (!file) return res.status(404).json({ error: 'File not found' });

    let canRename = (file.owner_id === userId);

    if (!canRename) {
        // Check if Editor
        const { data: share } = await supabase
            .from('shares')
            .select('role')
            .eq('resource_id', fileId)
            .eq('grantee_email', email)
            .single();
        
        if (share && share.role === 'editor') canRename = true;
    }

    if (!canRename) return res.status(403).json({ error: 'Access Denied: You must be an Editor to rename.' });

    // 2. Perform Rename
    const { error } = await supabase
      .from('files')
      .update({ name: newName })
      .eq('id', fileId);

    if (error) throw error;
    res.json({ success: true });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 15. Rename Folder (Secure: Owner OR Editor)
app.patch('/api/folders/rename', async (req, res) => {
  try {
    const { folderId, userId, newName, email } = req.body;

    // 1. Check Permissions
    const { data: folder } = await supabase.from('folders').select('owner_id').eq('id', folderId).single();
    
    if (!folder) return res.status(404).json({ error: 'Folder not found' });

    let canRename = (folder.owner_id === userId);

    if (!canRename) {
        // Check if Editor
        const { data: share } = await supabase
            .from('shares')
            .select('role')
            .eq('resource_id', folderId) // Assuming folders can be shared directly
            .eq('grantee_email', email)
            .single();
        
        if (share && share.role === 'editor') canRename = true;
    }

    if (!canRename) return res.status(403).json({ error: 'Access Denied: You must be an Editor to rename.' });

    // 2. Perform Rename
    const { error } = await supabase
      .from('folders')
      .update({ name: newName })
      .eq('id', folderId);

    if (error) throw error;
    res.json({ success: true });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 15. Delete Folder (Soft) - UPDATED
app.post('/api/folders/delete', async (req, res) => {
  try {
    const { folderId, userId } = req.body;

    // Soft delete the folder
    const { error: folderError } = await supabase
      .from('folders')
      .update({ is_deleted: true })
      .eq('id', folderId)
      .eq('owner_id', userId);

    if (folderError) throw folderError;

    // OPTIONAL: Also soft-delete all files inside this folder?
    // For MVP, hiding the folder is enough, but "best practice" is to hide contents too.
    await supabase
      .from('files')
      .update({ is_deleted: true })
      .eq('folder_id', folderId)
      .eq('owner_id', userId);

    res.json({ success: true });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 16. Global Search Route
app.get('/api/files/search', async (req, res) => {
  try {
    const { userId, query } = req.query;

    if (!query || query.length < 2) return res.json({ files: [], folders: [] });

    // A. Search Folders
    const { data: folders } = await supabase
      .from('folders')
      .select('id, name')
      .eq('owner_id', userId)
      .eq('is_deleted', false)
      .ilike('name', `%${query}%`) // Case-insensitive match
      .limit(5);

    // B. Search Files
    const { data: files } = await supabase
      .from('files')
      .select('*')
      .eq('owner_id', userId)
      .eq('is_deleted', false)
      .ilike('name', `%${query}%`)
      .limit(10);

    // C. Generate Signed URLs for the files found
    const filesWithUrls = await Promise.all(
      (files || []).map(async (file) => {
        const { data } = await supabase.storage
          .from('user-data')
          .createSignedUrl(file.storage_key, 3600); // 1 hour link
        return { ...file, publicUrl: data?.signedUrl };
      })
    );

    res.json({ files: filesWithUrls, folders: folders || [] });

  } catch (err) {
    console.error('Search Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 17. Get Users with Access (for a specific file/folder)
app.get('/api/shares/:resourceId', async (req, res) => {
  try {
    const { resourceId } = req.params;

    const { data: shares, error } = await supabase
      .from('shares')
      .select('id, grantee_email, role, created_at')
      .eq('resource_id', resourceId);

    if (error) throw error;
    res.json(shares);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 18. Revoke Access (Unshare)
app.delete('/api/shares/:shareId', async (req, res) => {
  try {
    const { shareId } = req.params;

    // Ideally, check if the requester is the OWNER of the resource before deleting.
    // For MVP, RLS on the database handles this (we added "Owners can manage shares" policy earlier).
    
    const { error } = await supabase
      .from('shares')
      .delete()
      .eq('id', shareId);

    if (error) throw error;
    res.json({ success: true });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// 19. Empty Trash (Permanent Delete)
app.delete('/api/trash/empty', async (req, res) => {
  try {
    const { userId } = req.body;

    // 1. Delete all trashed files
    const { error: fileError } = await supabase
      .from('files')
      .delete()
      .eq('owner_id', userId)
      .eq('is_deleted', true);

    if (fileError) throw fileError;

    // 2. Delete all trashed folders
    const { error: folderError } = await supabase
      .from('folders')
      .delete()
      .eq('owner_id', userId)
      .eq('is_deleted', true);

    if (folderError) throw folderError;

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 21. Update Share Permission (Change Role)
app.patch('/api/shares/:shareId', async (req, res) => {
  try {
    const { shareId } = req.params;
    const { role } = req.body; // 'viewer' or 'editor'

    const { data, error } = await supabase
      .from('shares')
      .update({ role })
      .eq('id', shareId)
      .select();

    if (error) throw error;
    res.json({ success: true, share: data[0] });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



// 22. Copy File (Duplicate) 
app.post('/api/files/copy', async (req, res) => {
  try {
    const { userId, fileId } = req.body;

    // 1. Get original file details
    const { data: original } = await supabase.from('files').select('*').eq('id', fileId).single();
    if (!original) return res.status(404).json({ error: 'File not found' });

    // 2. Prepare new filename
    const parts = original.name.split('.');
    const ext = parts.pop();
    const base = parts.join('.');
    const newName = `${base} (Copy).${ext}`;
    const newPath = `${userId}/${Date.now()}_${newName}`;

    // 3. Copy in Storage
    const { error: storageError } = await supabase.storage
      .from('user-data')
      .copy(original.storage_key, newPath);

    if (storageError) throw storageError;

    // 4. Create DB Record
    // FIX: We manually construct the object instead of spreading ...original
    // This ensures we don't accidentally send 'id' or 'created_at'
    const { data: newFile, error: dbError } = await supabase
      .from('files')
      .insert([{
        owner_id: userId,
        name: newName,
        storage_key: newPath,
        mime_type: original.mime_type,
        size_bytes: original.size_bytes,
        folder_id: original.folder_id, // Keep it in same folder
        is_starred: false, // Reset star status
        is_deleted: false  // Reset deleted status
      }])
      .select();

    if (dbError) throw dbError;

    res.json({ success: true, file: newFile[0] });

  } catch (err) {
    console.error("Copy Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Note: Ensure /api/files/rename (Route 14/15) is implemented as discussed in Phase 3.7
// If you missed adding a File Rename route specifically (we did Folders), here it is:
app.patch('/api/files/rename', async (req, res) => {
  try {
    const { fileId, userId, newName } = req.body;
    if (!newName.trim()) return res.status(400).json({ error: 'Invalid name' });

    const { data, error } = await supabase
      .from('files')
      .update({ name: newName })
      .eq('id', fileId)
      .eq('owner_id', userId)
      .select();

    if (error) throw error;
    res.json({ success: true, file: data[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 23. Toggle Star Status
app.patch('/api/files/star', async (req, res) => {
  try {
    const { userId, fileId, value } = req.body; // value = true/false

    const { data, error } = await supabase
      .from('files')
      .update({ is_starred: value })
      .eq('id', fileId)
      .eq('owner_id', userId)
      .select();

    if (error) throw error;
    res.json({ success: true, file: data[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// --- HELPER: Recursively find all subfolder IDs ---
async function getAllDescendantFolderIds(userId, startFolderIds) {
  let allIds = [...startFolderIds];
  let currentLevelIds = [...startFolderIds];

  // Keep searching deeper until no more children are found
  while (currentLevelIds.length > 0) {
    const { data: children } = await supabase
      .from('folders')
      .select('id')
      .eq('owner_id', userId)
      .in('parent_id', currentLevelIds);

    if (!children || children.length === 0) break;

    const childIds = children.map(c => c.id);
    allIds = [...allIds, ...childIds];
    currentLevelIds = childIds; // Next iteration searches children of these children
  }
  
  return allIds;
}

// 24. Permanently Delete Single Item (Recursive Fix)
app.delete('/api/files/permanent', async (req, res) => {
  try {
    const { userId, fileId, resourceType } = req.body;

    if (resourceType === 'folder') {
        // 1. Get ALL folder IDs involved (The target + all subfolders)
        const allFolderIds = await getAllDescendantFolderIds(userId, [fileId]);

        // 2. Get ALL files inside ANY of these folders
        const { data: filesToDelete } = await supabase
            .from('files')
            .select('id, storage_key')
            .eq('owner_id', userId)
            .in('folder_id', allFolderIds);

        // 3. Delete Files from Storage
        if (filesToDelete && filesToDelete.length > 0) {
            const paths = filesToDelete.map(f => f.storage_key);
            await supabase.storage.from('user-data').remove(paths);
            
            // 4. Delete Files from DB
            const fileIds = filesToDelete.map(f => f.id);
            await supabase.from('files').delete().in('id', fileIds);
        }

        // 5. Delete Folders from DB (Postgres usually handles parents if children are gone, 
        // but explicit delete by ID list is safest)
        await supabase.from('folders').delete().in('id', allFolderIds);

    } else {
        // Simple File Delete
        const { data: file } = await supabase.from('files').select('storage_key').eq('id', fileId).single();
        if (file) {
             await supabase.storage.from('user-data').remove([file.storage_key]);
        }
        await supabase.from('files').delete().eq('id', fileId);
    }

    res.json({ success: true });

  } catch (err) {
    console.error("Delete Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// 25. Empty Trash (Recursive Fix)
app.delete('/api/trash/empty', async (req, res) => {
  try {
    const { userId } = req.body;

    // A. Find all Root-level items in Trash
    const { data: trashFolders } = await supabase
      .from('folders')
      .select('id')
      .eq('owner_id', userId)
      .eq('is_deleted', true);

    const rootTrashIds = trashFolders ? trashFolders.map(f => f.id) : [];

    // B. Expand to find ALL nested subfolders of these trash items
    // (Even if subfolders weren't explicitly marked is_deleted, they die with the parent)
    const allFolderIdsToDelete = await getAllDescendantFolderIds(userId, rootTrashIds);

    // C. Find files to delete
    // 1. Files explicitly in trash
    const { data: explicitFiles } = await supabase
      .from('files')
      .select('id, storage_key')
      .eq('owner_id', userId)
      .eq('is_deleted', true);

    // 2. Files inside the folders we are about to destroy
    let implicitFiles = [];
    if (allFolderIdsToDelete.length > 0) {
        const { data } = await supabase
            .from('files')
            .select('id, storage_key')
            .in('folder_id', allFolderIdsToDelete);
        implicitFiles = data || [];
    }

    // D. Combine Lists
    const filesToDelete = [...(explicitFiles || []), ...implicitFiles];
    // Remove duplicates (in case a file was explicitly deleted AND inside a deleted folder)
    const uniqueFiles = Array.from(new Map(filesToDelete.map(item => [item.id, item])).values());

    // E. Execute Deletions
    
    // 1. Storage
    if (uniqueFiles.length > 0) {
        const paths = uniqueFiles.map(f => f.storage_key);
        await supabase.storage.from('user-data').remove(paths);
        
        // 2. Files DB
        const fileIds = uniqueFiles.map(f => f.id);
        await supabase.from('files').delete().in('id', fileIds);
    }

    // 3. Folders DB
    if (allFolderIdsToDelete.length > 0) {
        await supabase.from('folders').delete().in('id', allFolderIdsToDelete);
    }

    res.json({ success: true });

  } catch (err) {
    console.error("Empty Trash Error:", err);
    res.status(500).json({ error: err.message });
  }
});


app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
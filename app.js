// Global State
let fileHandles = [];

// DOM Elements - Buttons & Tables
const selectFilesBtn = document.getElementById('selectFilesBtn');
const renameBtn = document.getElementById('renameBtn');
const fileList = document.getElementById('fileList');

// DOM Elements - Rules
const clearAll = document.getElementById('clearAll');
const trimEnd = document.getElementById('trimEnd');
const findInput = document.getElementById('findText');
const replaceInput = document.getElementById('replaceText');
const prefixInput = document.getElementById('prefixText');
const seqEnable = document.getElementById('seqEnable');
const seqStart = document.getElementById('seqStart');
const seqPadding = document.getElementById('seqPadding');

// Event Listeners
selectFilesBtn.addEventListener('click', handleSelectFiles);
renameBtn.addEventListener('click', executeRename);

// Trigger live preview on any input change
[
  clearAll, trimEnd, 
  findInput, replaceInput, 
  prefixInput, 
  seqEnable, seqStart, seqPadding
].forEach(input => {
  input.addEventListener('input', renderPreview);
  input.addEventListener('change', renderPreview);
});

// 1. Prompt user to select specific files
async function handleSelectFiles() {
  if (!('showOpenFilePicker' in window)) {
    const currentUrl = window.location.href;
    document.getElementById('edgeLink').href = `microsoft-edge:${currentUrl}`;
    document.getElementById('browserPopup').style.display = 'flex';
    return;
  }

  try {
    fileHandles = await window.showOpenFilePicker({ multiple: true });
    renameBtn.disabled = fileHandles.length === 0;
    renderPreview();
  } catch (error) {
    if (error.name !== 'AbortError') {
      console.error('File selection failed:', error);
    }
  }
}

// Popup Helper Functions
function closePopup() {
  document.getElementById('browserPopup').style.display = 'none';
}

function copyUrl() {
  navigator.clipboard.writeText(window.location.href).then(() => {
    alert('Link copied! Open Chrome and paste it in the address bar.');
    closePopup();
  }).catch(err => console.error('Failed to copy text: ', err));
}

// Helper: Separate extension from filename
function splitExtension(filename) {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1 || lastDot === 0) return { name: filename, ext: '' };
  return {
    name: filename.substring(0, lastDot),
    ext: filename.substring(lastDot)
  };
}

// 2. The Rule Engine: Calculate new names based on user input & file index
function generateNewName(oldName, index) {
  let { name, ext } = splitExtension(oldName);
  
  if (clearAll.checked) {
    name = '';
  } else {
    const trimCount = parseInt(trimEnd.value, 10) || 0;
    if (trimCount > 0) {
      name = name.slice(0, Math.max(0, name.length - trimCount));
    }
  }
  
  const findStr = findInput.value;
  const replaceStr = replaceInput.value;
  if (findStr && name.length > 0) {
    name = name.split(findStr).join(replaceStr);
  }
  
  if (prefixInput.value) {
    name = prefixInput.value + name;
  }
  
  if (seqEnable.checked) {
    const parsedStart = parseInt(seqStart.value, 10);
    const startNum = isNaN(parsedStart) ? 1 : parsedStart;
    
    const parsedPadding = parseInt(seqPadding.value, 10);
    const padding = isNaN(parsedPadding) ? 0 : Math.max(0, parsedPadding);
    
    const currentNum = startNum + index;
    const numStr = String(currentNum).padStart(padding, '0'); 
    
    name = name + numStr; 
  }
  
  if (name.trim() === '') {
    name = 'unnamed_file_' + String(index + 1).padStart(3, '0');
  }
  
  return name + ext;
}

// 3. Update the UI Table
function renderPreview() {
  if (fileHandles.length === 0) return;
  
  fileList.innerHTML = ''; 
  
  fileHandles.forEach((handle, index) => {
    const oldName = handle.name;
    const newName = generateNewName(oldName, index);
    
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${oldName}</td>
      <td><strong>${newName}</strong></td>
      <td id="status-${index}" class="status-ready">Ready</td>
    `;
    fileList.appendChild(row);
  });
}

// 4. Ask for destination, create subfolder, and copy files
async function executeRename() {
  let parentDirectoryHandle;
  
  // Step 1: Ask the user where they want to save the new folder
  try {
    parentDirectoryHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
  } catch (error) {
    if (error.name !== 'AbortError') {
      console.error('Failed to select destination folder:', error);
    }
    return;
  }

  renameBtn.disabled = true; 
  
  try {
    // Step 2: Create a unique subfolder automatically (e.g., "Renamed_Files_2023-10-25T14-30-00")
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const newFolderName = `Renamed_Files_${timestamp}`;
    
    // This tells the browser to create the directory if it doesn't exist
    const destDirectoryHandle = await parentDirectoryHandle.getDirectoryHandle(newFolderName, { create: true });

    // Step 3: Loop through files, create new ones inside the brand new subfolder
    for (let i = 0; i < fileHandles.length; i++) {
      const handle = fileHandles[i];
      const oldName = handle.name;
      const newName = generateNewName(oldName, i);
      const statusCell = document.getElementById(`status-${i}`);
      
      try {
        statusCell.textContent = 'Saving...';
        
        // Get the actual raw data of the original file
        const originalFile = await handle.getFile();
        
        // Create the new file inside the dynamically created subfolder
        const newFileHandle = await destDirectoryHandle.getFileHandle(newName, { create: true });
        const writable = await newFileHandle.createWritable();
        
        // Stream the data across
        await originalFile.stream().pipeTo(writable);
        
        statusCell.textContent = 'Saved!';
        statusCell.className = 'status-success';
      } catch (error) {
        statusCell.textContent = 'Error';
        statusCell.className = 'status-error';
        console.error(`Failed to copy and rename ${oldName}`, error);
      }
    }
  } catch (error) {
    console.error('Failed to create subfolder or save files:', error);
    alert('An error occurred while creating the folder or saving the files. Please check permissions.');
  }
  
  renameBtn.disabled = false;
}

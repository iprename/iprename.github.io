// Global State
let directoryHandle = null;
let fileHandles = [];

// DOM Elements
const selectFolderBtn = document.getElementById('selectFolderBtn');
const renameBtn = document.getElementById('renameBtn');
const fileList = document.getElementById('fileList');
const findInput = document.getElementById('findText');
const replaceInput = document.getElementById('replaceText');

// Event Listeners
selectFolderBtn.addEventListener('click', handleSelectFolder);
renameBtn.addEventListener('click', executeRename);
findInput.addEventListener('input', renderPreview);
replaceInput.addEventListener('input', renderPreview);

// 1. Prompt user to select a folder
async function handleSelectFolder() {
  // Feature Check: If browser does NOT support direct disk access
  if (!('showDirectoryPicker' in window)) {
    const currentUrl = window.location.href;
    document.getElementById('edgeLink').href = `microsoft-edge:${currentUrl}`;
    document.getElementById('browserPopup').style.display = 'flex';
    return; // Stop execution here
  }

  // If browser supports it, open the folder picker
  try {
    directoryHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
    fileHandles = []; 
    
    for await (const entry of directoryHandle.values()) {
      if (entry.kind === 'file') {
        fileHandles.push(entry);
      }
    }
    
    renameBtn.disabled = fileHandles.length === 0;
    renderPreview();
    
  } catch (error) {
    if (error.name !== 'AbortError') {
      console.error('Folder selection failed:', error);
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
  }).catch(err => {
    console.error('Failed to copy text: ', err);
  });
}

// 2. The Rule Engine: Calculate new names based on user input
function generateNewName(oldName) {
  const findStr = findInput.value;
  const replaceStr = replaceInput.value;
  
  if (!findStr) return oldName; // If nothing to find, name stays the same
  
  // Replace all instances of the found text
  return oldName.split(findStr).join(replaceStr);
}

// 3. Update the UI Table
function renderPreview() {
  if (fileHandles.length === 0) return;
  
  fileList.innerHTML = ''; // Clear table
  
  fileHandles.forEach(handle => {
    const oldName = handle.name;
    const newName = generateNewName(oldName);
    const isChanging = oldName !== newName;
    
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${oldName}</td>
      <td><strong>${newName}</strong></td>
      <td id="status-${oldName}" class="${isChanging ? 'status-ready' : ''}">
        ${isChanging ? 'Ready to rename' : 'Unchanged'}
      </td>
    `;
    fileList.appendChild(row);
  });
}

// 4. Execute the rename on the hard drive
async function executeRename() {
  renameBtn.disabled = true; // Prevent double-clicking
  
  for (const handle of fileHandles) {
    const oldName = handle.name;
    const newName = generateNewName(oldName);
    const statusCell = document.getElementById(`status-${oldName}`);
    
    if (oldName !== newName) {
      try {
        await handle.move(newName);
        statusCell.textContent = 'Success!';
        statusCell.className = 'status-success';
      } catch (error) {
        statusCell.textContent = 'Error: ' + error.message;
        statusCell.className = 'status-error';
        console.error(`Failed to rename ${oldName}`, error);
      }
    }
  }
  
  // Optionally clear inputs and refresh after renaming
  findInput.value = '';
  replaceInput.value = '';
  // Reload the directory contents
  fileHandles = [];
  for await (const entry of directoryHandle.values()) {
    if (entry.kind === 'file') fileHandles.push(entry);
  }
  renderPreview();
}

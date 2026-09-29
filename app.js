// Global State
let fileHandles = [];

// DOM Elements
const selectFilesBtn = document.getElementById('selectFilesBtn');
const renameBtn = document.getElementById('renameBtn');
const fileList = document.getElementById('fileList');
const findInput = document.getElementById('findText');
const replaceInput = document.getElementById('replaceText');

// Event Listeners
selectFilesBtn.addEventListener('click', handleSelectFiles);
renameBtn.addEventListener('click', executeRename);
findInput.addEventListener('input', renderPreview);
replaceInput.addEventListener('input', renderPreview);

// 1. Prompt user to select specific files (Ctrl/Shift to select multiple)
async function handleSelectFiles() {
  // Feature Check: If browser does NOT support direct disk access
  if (!('showOpenFilePicker' in window)) {
    const currentUrl = window.location.href;
    document.getElementById('edgeLink').href = `microsoft-edge:${currentUrl}`;
    document.getElementById('browserPopup').style.display = 'flex';
    return; // Stop execution here
  }

  // If browser supports it, open the multi-file picker
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
        // Request write permission for the file before renaming
        if ((await handle.queryPermission({ mode: 'readwrite' })) !== 'granted') {
          await handle.requestPermission({ mode: 'readwrite' });
        }
        
        // .move() executes the rename directly on the disk
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
  
  // Clear inputs and refresh preview to show the updated file names
  findInput.value = '';
  replaceInput.value = '';
  renderPreview();
}

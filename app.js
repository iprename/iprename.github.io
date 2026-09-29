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

// 1. Prompt user to select files
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
  
  // Rule 1: Trim / Clear Original Name
  if (clearAll.checked) {
    name = '';
  } else {
    const trimCount = parseInt(trimEnd.value, 10) || 0;
    if (trimCount > 0) {
      name = name.slice(0, Math.max(0, name.length - trimCount));
    }
  }
  
  // Rule 2: Find & Replace
  const findStr = findInput.value;
  const replaceStr = replaceInput.value;
  if (findStr && name.length > 0) {
    name = name.split(findStr).join(replaceStr);
  }
  
  // Rule 3: Add Prefix
  if (prefixInput.value) {
    name = prefixInput.value + name;
  }
  
  // Rule 4: Sequential Numbering
  if (seqEnable.checked) {
    // Parse safely to ensure 0 is treated as a valid number, not fallback to 1
    const parsedStart = parseInt(seqStart.value, 10);
    const startNum = isNaN(parsedStart) ? 1 : parsedStart;
    
    // Parse padding safely to allow '0'
    const parsedPadding = parseInt(seqPadding.value, 10);
    const padding = isNaN(parsedPadding) ? 0 : Math.max(0, parsedPadding);
    
    const currentNum = startNum + index;
    const numStr = String(currentNum).padStart(padding, '0'); 
    
    name = name + numStr; 
  }
  
  // Safety Net: Prevent empty file names
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
    const isChanging = oldName !== newName;
    
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${oldName}</td>
      <td><strong>${newName}</strong></td>
      <td id="status-${index}" class="${isChanging ? 'status-ready' : ''}">
        ${isChanging ? 'Ready' : 'Unchanged'}
      </td>
    `;
    fileList.appendChild(row);
  });
}

// 4. Execute the rename on the hard drive
async function executeRename() {
  renameBtn.disabled = true; 
  
  for (let i = 0; i < fileHandles.length; i++) {
    const handle = fileHandles[i];
    const oldName = handle.name;
    const newName = generateNewName(oldName, i);
    const statusCell = document.getElementById(`status-${i}`);
    
    if (oldName !== newName) {
      try {
        if ((await handle.queryPermission({ mode: 'readwrite' })) !== 'granted') {
          await handle.requestPermission({ mode: 'readwrite' });
        }
        
        await handle.move(newName);
        statusCell.textContent = 'Success!';
        statusCell.className = 'status-success';
      } catch (error) {
        statusCell.textContent = 'Error';
        statusCell.className = 'status-error';
        console.error(`Failed to rename ${oldName}`, error);
      }
    }
  }
  
  renameBtn.disabled = false;
}

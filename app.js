// Global State
let fileHandles = [];

// DOM Elements - Buttons & Tables
const selectFilesBtn = document.getElementById('selectFilesBtn');
const renameBtn = document.getElementById('renameBtn');
const fileList = document.getElementById('fileList');

// DOM Elements - Rules
const findInput = document.getElementById('findText');
const replaceInput = document.getElementById('replaceText');
const seqEnable = document.getElementById('seqEnable');
const seqPrefix = document.getElementById('seqPrefix');
const seqStart = document.getElementById('seqStart');
const seqPadding = document.getElementById('seqPadding');

// Event Listeners
selectFilesBtn.addEventListener('click', handleSelectFiles);
renameBtn.addEventListener('click', executeRename);

// Trigger live preview on any input change
[findInput, replaceInput, seqEnable, seqPrefix, seqStart, seqPadding].forEach(input => {
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

// Helper: Separate extension from filename (e.g. "photo.jpg" -> "photo" and ".jpg")
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
  
  // Rule 1: Find & Replace
  const findStr = findInput.value;
  const replaceStr = replaceInput.value;
  if (findStr) {
    name = name.split(findStr).join(replaceStr);
  }
  
  // Rule 2: Sequential Numbering
  if (seqEnable.checked) {
    const prefix = seqPrefix.value;
    const startNum = parseInt(seqStart.value, 10) || 1;
    const padding = parseInt(seqPadding.value, 10) || 1;
    
    const currentNum = startNum + index;
    // padStart formats '1' to '001' if padding is 3
    const numStr = String(currentNum).padStart(padding, '0'); 
    
    name = name + prefix + numStr;
  }
  
  // Reattach extension
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
  
  // Clear inputs and refresh preview
  findInput.value = '';
  replaceInput.value = '';
  seqEnable.checked = false;
  renderPreview();
}

// packages.js — merged + enhanced with drag & drop (reorder + cross-list move), edit modal, selection, archive, delete, add
// Drop this file in place of your existing packages.js

const LS_KEY = 'heigen_packages_v1';

/* ======================
   DOM ELEMENTS (expected in HTML)
   ====================== */
const pkgListEl = document.getElementById('pkgList');
const archListEl = document.getElementById('archList');

const pkgSelectBtn = document.getElementById('pkgSelectBtn');
const pkgActionBtn = document.getElementById('pkgActionBtn');
const pkgCancelBtn = document.getElementById('pkgCancelBtn');
const pkgAddBtn = document.getElementById('pkgAddBtn');
const pkgHint = document.getElementById('pkgHint');

const pkgDeleteBtn = document.getElementById('pkgDeleteBtn');
const pkgEditBtn = document.getElementById('pkgEditBtn');

const archSelectBtn = document.getElementById('archSelectBtn');
const archActionBtn = document.getElementById('archActionBtn');
const archCancelBtn = document.getElementById('archCancelBtn');
const archDeleteBtn = document.getElementById('archDeleteBtn');
const archEditBtn = document.getElementById('archEditBtn');
const archHint = document.getElementById('archHint');

const addModal = document.getElementById('addModal');
const newNameInput = document.getElementById('newName');
const newImageInput = document.getElementById('newImage');
const newImageFile = document.getElementById('newImageFile');
const previewImg = document.getElementById('previewImg');
const addCancel = document.getElementById('addCancel');
const addConfirm = document.getElementById('addConfirm');

const editModal = document.getElementById('editModal');
const editNameInput = document.getElementById('editNameInput');
const editImageInput = document.getElementById('editImageInput');
const editImageFile = document.getElementById('editImageFile');
const editPreview = document.getElementById('editPreview');
const editCancelBtn = document.getElementById('editCancelBtn');
const editSaveBtn = document.getElementById('editSaveBtn');

/* ======================
   Config / Defaults
   ====================== */
const DEFAULT_PACKAGES = [
  { id: 'regularcover', name: 'Regular Packages', img: 'images/packagelist/package1.png' },
  { id: 'yearbookcover', name: 'Yearbook Packages', img: 'images/packagelist/package2.png' },
  { id: 'xmascover', name: 'Xmas Packages', img: 'images/packagelist/package3.png' }
];

// If true, show a confirm dialog when dragging across lists
const CONFIRM_ON_CROSS_MOVE = false;

/* ======================
   State
   ====================== */
let packageItems = [];
let archives = [];
let selectionModePkg = false;
let selectionModeArch = false;
let selectedPkg = new Set();
let selectedArch = new Set();
let editMode = false; // click-to-edit toolbar
let currentEditTarget = null; // { list: 'pkg'|'arch', id }

/* ======================
   Persistence
   ====================== */
function saveState(){
  try { localStorage.setItem(LS_KEY, JSON.stringify({ packageItems, archives })); }
  catch(e){ console.warn('save error', e); }
}
function loadState(){
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) { packageItems = DEFAULT_PACKAGES.slice(); archives = []; saveState(); return; }
    const parsed = JSON.parse(raw);
    packageItems = parsed.packageItems || DEFAULT_PACKAGES.slice();
    archives = parsed.archives || [];
  } catch(e) { console.warn('load error', e); packageItems = DEFAULT_PACKAGES.slice(); archives = []; }
}

/* ======================
   Rendering / Factory
   ====================== */

function renderLists(){
  if (pkgListEl) {
    pkgListEl.innerHTML = '';
    packageItems.forEach((item, idx) => {
      const card = createCard(item, 'pkg', idx);
      if (selectedPkg.has(item.id)) card.classList.add('selected');
      pkgListEl.appendChild(card);
    });
  }

  if (archListEl) {
    archListEl.innerHTML = '';
    archives.forEach((item, idx) => {
      const card = createCard(item, 'arch', idx);
      if (selectedArch.has(item.id)) card.classList.add('selected');
      archListEl.appendChild(card);
    });
  }

  updateToolbarHints();
}

/**
 * createCard(item, area, index)
 * - area: 'pkg' or 'arch' (used for data attributes & drag payload)
 * - index: position in its list (used by keyboard reorder)
 */
function createCard(item, area, index){
  if (!item || typeof item !== 'object') {
    const ph = document.createElement('div');
    ph.className = 'pkg-card';
    ph.textContent = 'Invalid item';
    return ph;
  }

  const card = document.createElement('div');
  card.className = 'pkg-card';
  card.dataset.id = String(item.id ?? '');
  card.dataset.area = area;
  card.dataset.index = String(index ?? 0);
  card.style.position = 'relative';
  card.tabIndex = 0;

  // image
  const img = document.createElement('img');
  img.className = 'cover';
  img.alt = item.name || 'cover';
  try { img.src = item.img || 'images/placeholder.jpg'; } catch(e){ img.style.display='none'; }

  img.addEventListener('error', function errH(){
    if (this.dataset._errored) { this.style.display='none'; this.removeEventListener('error', errH); return; }
    this.dataset._errored = '1';
    const fallback = 'images/placeholder.jpg';
    if (!this.src || !this.src.includes(fallback)) this.src = fallback;
    else { this.style.display='none'; this.removeEventListener('error', errH); }
  });

  const frame = document.createElement('div');
  frame.style.width = '220px';
  frame.style.height = '170px';
  frame.style.display = 'flex';
  frame.style.alignItems = 'center';
  frame.style.justifyContent = 'center';
  frame.style.boxSizing = 'border-box';
  frame.appendChild(img);

  const label = document.createElement('div');
  label.className = 'label';
  label.textContent = item.name || 'Untitled';
  label.style.marginTop = '10px';
  label.style.textAlign = 'center';
  label.style.fontWeight = '700';
  label.style.color = '#2a3a3a';

  card.appendChild(frame);
  card.appendChild(label);

  // pencil icon
  const editIcon = document.createElement('img');
  editIcon.src = 'images/packagelist/pencil.svg';
  editIcon.className = 'card-edit-icon';
  editIcon.alt = 'edit';
  editIcon.style.position = 'absolute';
  editIcon.style.top = '8px';
  editIcon.style.right = '8px';
  editIcon.style.width = '22px';
  editIcon.style.height = '22px';
  editIcon.style.cursor = 'pointer';
  editIcon.style.background = 'rgba(255,255,255,0.95)';
  editIcon.style.borderRadius = '6px';
  editIcon.style.boxShadow = '0 2px 6px rgba(0,0,0,0.12)';
  editIcon.addEventListener('click', (e) => {
    e.stopPropagation();
    openEditModal(item);
  });
  card.appendChild(editIcon);

  // draggable
  card.draggable = true;
  card.addEventListener('dragstart', (e) => {
    const payload = { id: item.id, from: area, idx: index };
    e.dataTransfer.setData('text/plain', JSON.stringify(payload));
    e.dataTransfer.effectAllowed = 'move';
    card.classList.add('dragging');
  });
  card.addEventListener('dragend', () => {
    card.classList.remove('dragging');
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
  });

  // click behavior
  card.addEventListener('click', (e) => {
    if (editMode) { e.stopPropagation(); openEditModal(item); exitEditMode(); return; }
    if (selectionModePkg && area === 'pkg') { toggleSelectPkg(item.id, card); return; }
    if (selectionModeArch && area === 'arch') { toggleSelectArch(item.id, card); return; }
    // no-op otherwise
  });

  // keyboard: Enter opens edit in editMode or toggles selection when selecting
  card.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); card.click(); }
    // keyboard move shortcuts: Ctrl+ArrowRight / Ctrl+ArrowLeft to move between lists
    if (ev.ctrlKey && (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft')) {
      ev.preventDefault();
      keyboardMoveCard(item.id, area, ev.key === 'ArrowRight' ? 'right' : 'left');
    }
    // reorder with Alt+ArrowUp / Alt+ArrowDown
    if (ev.altKey && (ev.key === 'ArrowUp' || ev.key === 'ArrowDown')) {
      ev.preventDefault();
      keyboardReorder(item.id, area, ev.key === 'ArrowUp' ? -1 : 1);
    }
  });

  return card;
}

/* ======================
   Preview / Add
   ====================== */
if (newImageFile) {
  newImageFile.addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (!f) { if (previewImg) previewImg.src = 'images/placeholder.jpg'; return; }
    const r = new FileReader();
    r.onload = () => { if (previewImg) previewImg.src = r.result; };
    r.readAsDataURL(f);
  });
}

function openAddModal(){
  if (!newNameInput) return;
  newNameInput.value = '';
  if (newImageInput) newImageInput.value = '';
  if (newImageFile) newImageFile.value = '';
  if (previewImg) previewImg.src = 'images/placeholder.jpg';
  if (!addModal) return;
  addModal.classList.add('show');
  addModal.classList.remove('modal-hidden');
  setTimeout(()=> newNameInput.focus(), 60);
}
function closeAddModal(){ if (!addModal) return; addModal.classList.remove('show'); addModal.classList.add('modal-hidden'); }
if (addCancel) addCancel.addEventListener('click', closeAddModal);

if (addConfirm) addConfirm.addEventListener('click', ()=>{
  if (!newNameInput) return;
  const name = (newNameInput.value || 'New Package').trim();
  const file = newImageFile ? newImageFile.files[0] : null;
  if (file){
    const r = new FileReader();
    r.onload = function(evt){
      pushNewPackage(name, evt.target.result);
      saveState(); closeAddModal(); renderLists();
    };
    r.readAsDataURL(file);
    return;
  }

  let imgVal = (newImageInput ? newImageInput.value : '') || '';
  imgVal = imgVal.trim();
  if (!imgVal) imgVal = 'images/placeholder.jpg';
  else if (!imgVal.startsWith('images/') && !imgVal.startsWith('data:')) imgVal = 'images/packagelist/' + imgVal;

  pushNewPackage(name, imgVal);
  saveState(); closeAddModal(); renderLists();
});

function pushNewPackage(name, imgSrc){
  const id = name.toLowerCase().replace(/\s+/g,'-') + '-' + Date.now();
  packageItems.push({ id, name, img: imgSrc });
}

/* ======================
   Selection helpers
   ====================== */
function toggleSelectPkg(id, cardEl){
  if (selectedPkg.has(id)){ selectedPkg.delete(id); if (cardEl) cardEl.classList.remove('selected'); }
  else { selectedPkg.add(id); if (cardEl) cardEl.classList.add('selected'); }
  updateToolbarHints();
}
function toggleSelectArch(id, cardEl){
  if (selectedArch.has(id)){ selectedArch.delete(id); if (cardEl) cardEl.classList.remove('selected'); }
  else { selectedArch.add(id); if (cardEl) cardEl.classList.add('selected'); }
  updateToolbarHints();
}
function updateToolbarHints(){
  if (pkgHint) pkgHint.textContent = selectionModePkg ? `${selectedPkg.size} selected` : '';
  if (archHint) archHint.textContent = selectionModeArch ? `${selectedArch.size} selected` : '';
}

/* ======================
   Toolbar handlers
   ====================== */
if (pkgSelectBtn) pkgSelectBtn.addEventListener('click', ()=> enterPkgSelection());
if (pkgCancelBtn) pkgCancelBtn.addEventListener('click', ()=> cancelPkgSelection());
if (pkgActionBtn) pkgActionBtn.addEventListener('click', ()=> archiveSelectedPackages());
if (pkgAddBtn) pkgAddBtn.addEventListener('click', openAddModal);

if (archSelectBtn) archSelectBtn.addEventListener('click', ()=> enterArchSelection());
if (archCancelBtn) archCancelBtn.addEventListener('click', ()=> cancelArchSelection());
if (archActionBtn) archActionBtn.addEventListener('click', ()=> restoreSelectedArchives());

// edit toolbar toggles (click-to-edit)
if (pkgEditBtn) pkgEditBtn.addEventListener('click', (e)=> { e.preventDefault(); toggleEditMode('pkg'); });
if (archEditBtn) archEditBtn.addEventListener('click', (e)=> { e.preventDefault(); toggleEditMode('arch'); });

/* ======================
   Selection / Archive / Delete actions
   ====================== */
function enterPkgSelection(){
  selectionModePkg = true;
  selectionModeArch = false;
  selectedPkg.clear();
  selectedArch.clear();

  if (pkgSelectBtn) pkgSelectBtn.style.display = 'none';
  if (pkgActionBtn) pkgActionBtn.style.display = '';
  if (pkgCancelBtn) pkgCancelBtn.style.display = '';
  if (pkgDeleteBtn) pkgDeleteBtn.style.display = '';
  if (pkgAddBtn) pkgAddBtn.style.display = 'none';
  if (pkgActionBtn) { pkgActionBtn.textContent = 'Archive'; pkgActionBtn.classList.add('primary'); }

  if (pkgAddBtn) pkgAddBtn.disabled = true;
  if (archSelectBtn) archSelectBtn.disabled = true;
  renderLists();
}
function cancelPkgSelection(){
  selectionModePkg = false;
  selectedPkg.clear();

  if (pkgSelectBtn) pkgSelectBtn.style.display = '';
  if (pkgActionBtn) pkgActionBtn.style.display = 'none';
  if (pkgCancelBtn) pkgCancelBtn.style.display = 'none';
  if (pkgDeleteBtn) pkgDeleteBtn.style.display = 'none';
  if (pkgAddBtn) pkgAddBtn.style.display = '';

  if (pkgAddBtn) pkgAddBtn.disabled = false;
  if (archSelectBtn) archSelectBtn.disabled = false;
  renderLists();
}
function archiveSelectedPackages(){
  if (selectedPkg.size === 0){ alert('Please select at least one package to archive.'); return; }
  const toArchive = packageItems.filter(i => selectedPkg.has(i.id));
  packageItems = packageItems.filter(i => !selectedPkg.has(i.id));
  toArchive.forEach(i => archives.push(Object.assign({}, i, { id: 'arch-' + i.id })));
  saveState();
  cancelPkgSelection();
  renderLists();
  flashMoved();
}

function enterArchSelection(){
  selectionModeArch = true;
  selectionModePkg = false;
  selectedPkg.clear();
  selectedArch.clear();

  if (archSelectBtn) archSelectBtn.style.display = 'none';
  if (archActionBtn) archActionBtn.style.display = '';
  if (archCancelBtn) archCancelBtn.style.display = '';
  if (archDeleteBtn) archDeleteBtn.style.display = '';
  if (archActionBtn) { archActionBtn.textContent = 'Restore'; archActionBtn.classList.add('primary'); }

  if (pkgSelectBtn) pkgSelectBtn.disabled = true;
  if (pkgAddBtn) pkgAddBtn.disabled = true;
  renderLists();
}
function cancelArchSelection(){
  selectionModeArch = false;
  selectedArch.clear();

  if (archSelectBtn) archSelectBtn.style.display = '';
  if (archActionBtn) archActionBtn.style.display = 'none';
  if (archCancelBtn) archCancelBtn.style.display = 'none';
  if (archDeleteBtn) archDeleteBtn.style.display = 'none';

  if (pkgSelectBtn) pkgSelectBtn.disabled = false;
  if (pkgAddBtn) pkgAddBtn.disabled = false;
  renderLists();
}
function restoreSelectedArchives(){
  if (selectedArch.size === 0){ alert('Please select at least one archived package to restore.'); return; }
  const toRestore = archives.filter(i => selectedArch.has(i.id));
  archives = archives.filter(i => !selectedArch.has(i.id));
  toRestore.forEach(i => packageItems.push(Object.assign({}, i, { id: String(i.id).replace(/^arch-/,'') })));
  saveState();
  cancelArchSelection();
  renderLists();
  flashMoved();
}

function deleteSelectedPackages(){
  if (selectedPkg.size === 0) { alert('Please select at least one package to delete.'); return; }
  if (!confirm('Delete the selected package(s)? This action cannot be undone.')) return;
  packageItems = packageItems.filter(item => !selectedPkg.has(item.id));
  selectedPkg.clear();
  saveState();
  cancelPkgSelection();
  renderLists();
}
if (pkgDeleteBtn) pkgDeleteBtn.addEventListener('click', (e)=> { e.preventDefault(); deleteSelectedPackages(); });

function deleteSelectedArchives(){
  if (selectedArch.size === 0) { alert('Please select at least one archived package to delete.'); return; }
  if (!confirm('Delete the selected archived package(s)? This cannot be undone.')) return;
  archives = archives.filter(item => !selectedArch.has(item.id));
  selectedArch.clear();
  saveState();
  cancelArchSelection();
  renderLists();
}
if (archDeleteBtn) archDeleteBtn.addEventListener('click', (e)=> { e.preventDefault(); deleteSelectedArchives(); });

/* ======================
   Edit modal
   ====================== */
function openEditModal(item){
  if (!item) return;
  // detect list
  const inPkg = packageItems.find(x => x.id === item.id);
  const inArch = archives.find(x => x.id === item.id);

  if (inPkg) currentEditTarget = { list: 'pkg', id: item.id };
  else if (inArch) currentEditTarget = { list: 'arch', id: item.id };
  else currentEditTarget = { list: 'pkg', id: item.id };

  if (editNameInput) editNameInput.value = item.name || '';
  if (editImageInput) editImageInput.value = (item.img && !item.img.startsWith('data:')) ? item.img : '';
  if (editPreview) editPreview.src = item.img || 'images/placeholder.jpg';

  if (!editModal) return;
  editModal.classList.add('show');
  editModal.classList.remove('modal-hidden');
}

if (editImageFile) {
  editImageFile.addEventListener('change', ()=> {
    const f = editImageFile.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = (e)=> { if (editPreview) editPreview.src = e.target.result; };
    r.readAsDataURL(f);
  });
}

if (editSaveBtn) editSaveBtn.addEventListener('click', ()=>{
  let id = null;
  let list = null;

  if (currentEditTarget && currentEditTarget.id) {
    id = currentEditTarget.id;
    list = (currentEditTarget.list === 'arch') ? archives : packageItems;
  } else if (selectedPkg.size === 1) {
    id = [...selectedPkg][0]; list = packageItems;
  } else if (selectedArch.size === 1) {
    id = [...selectedArch][0]; list = archives;
  } else {
    alert('Select exactly one item to edit.');
    return;
  }

  const idx = list.findIndex(x => x.id === id);
  if (idx === -1) return;

  // update name
  if (editNameInput) list[idx].name = editNameInput.value.trim() || list[idx].name;

  // update image (file precedence)
  if (editImageFile && editImageFile.files[0]) {
    const reader = new FileReader();
    reader.onload = ()=> { list[idx].img = reader.result; finalizeEdit(); };
    reader.readAsDataURL(editImageFile.files[0]);
  } else {
    const val = editImageInput ? editImageInput.value.trim() : '';
    if (val !== '') list[idx].img = val;
    finalizeEdit();
  }
});

function finalizeEdit(){
  saveState();
  renderLists();
  closeEditModal();
  currentEditTarget = null;
  if (selectionModePkg) cancelPkgSelection();
  if (selectionModeArch) cancelArchSelection();
}

function closeEditModal(){
  if (!editModal) return;
  editModal.classList.remove('show');
  if (editImageFile) editImageFile.value = '';
  currentEditTarget = null;
}
if (editCancelBtn) editCancelBtn.addEventListener('click', closeEditModal);

/* ======================
   Drag & Drop (reorder + cross-list)
   ====================== */

function setupDragDrop() {
  if (!pkgListEl || !archListEl) return;

  // helper: add listeners to container for drop/reorder zone
  [pkgListEl, archListEl].forEach(container => {
    container.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      container.classList.add('drag-over');
      // show insertion marker (we'll rely on visual only)
    });

    container.addEventListener('dragleave', (e) => {
      container.classList.remove('drag-over');
    });

    container.addEventListener('drop', (e) => {
      e.preventDefault();
      container.classList.remove('drag-over');
      const raw = e.dataTransfer.getData('text/plain');
      if (!raw) return;
      let payload;
      try { payload = JSON.parse(raw); } catch (err) { return; }
      const { id: draggedId, from } = payload;
      const targetArea = (container === pkgListEl) ? 'pkg' : 'arch';

      // if same area -> attempt reorder: place at end (or compute position)
      if (from === targetArea) {
        // find index of drop target: approximate by mouse Y
        const rect = container.getBoundingClientRect();
        const y = e.clientY - rect.top;
        // find insert index based on children midpoints
        let insertIndex = Array.from(container.children).findIndex(child => {
          const r = child.getBoundingClientRect();
          return y < (r.top + r.height/2 - rect.top);
        });
        if (insertIndex === -1) insertIndex = container.children.length;

        if (targetArea === 'pkg') {
          const idx = packageItems.findIndex(i => i.id === draggedId);
          if (idx === -1) return;
          const [item] = packageItems.splice(idx,1);
          // adjust insertIndex if removing earlier element affects position
          const normalizedIndex = Math.min(insertIndex, packageItems.length);
          packageItems.splice(normalizedIndex, 0, item);
          saveState(); renderLists();
        } else {
          const idx = archives.findIndex(i => i.id === draggedId);
          if (idx === -1) return;
          const [item] = archives.splice(idx,1);
          const normalizedIndex = Math.min(insertIndex, archives.length);
          archives.splice(normalizedIndex, 0, item);
          saveState(); renderLists();
        }
        flashMoved();
        return;
      }

      // cross-list move: confirm optionally
      if (CONFIRM_ON_CROSS_MOVE) {
        const ok = confirm('Move this folder between Package Category and Archives?');
        if (!ok) return;
      }

      // move item between lists
      if (from === 'pkg' && targetArea === 'arch') {
        const idx = packageItems.findIndex(x => x.id === draggedId);
        if (idx === -1) return;
        const item = packageItems.splice(idx,1)[0];
        archives.push(Object.assign({}, item, { id: 'arch-' + item.id }));
        saveState(); renderLists(); flashMoved();
        return;
      }

      if (from === 'arch' && targetArea === 'pkg') {
        const idx = archives.findIndex(x => x.id === draggedId);
        if (idx === -1) return;
        const item = archives.splice(idx,1)[0];
        const restoredId = String(item.id).replace(/^arch-/,'');
        // ensure unique id
        let finalId = restoredId;
        if (packageItems.some(p => p.id === finalId)) finalId = restoredId + '-' + Date.now();
        packageItems.push(Object.assign({}, item, { id: finalId }));
        saveState(); renderLists(); flashMoved();
        return;
      }
    });
  });
}

/* ======================
   Keyboard helpers for accessibility
   - Alt+Up / Alt+Down reorder within same list (on focused card)
   - Ctrl+ArrowLeft / Ctrl+ArrowRight move item across lists
   ====================== */

function findCardElementById(id) {
  return document.querySelector(`.pkg-card[data-id="${CSS.escape(String(id))}"]`);
}

// keyboard reorder within same list
function keyboardReorder(id, area, direction) {
  if (area === 'pkg') {
    const idx = packageItems.findIndex(i => i.id === id);
    if (idx === -1) return;
    const newIndex = Math.max(0, Math.min(packageItems.length - 1, idx + direction));
    if (newIndex === idx) return;
    const [item] = packageItems.splice(idx,1);
    packageItems.splice(newIndex, 0, item);
    saveState(); renderLists();
    const el = findCardElementById(id); if (el) el.focus();
  } else {
    const idx = archives.findIndex(i => i.id === id);
    if (idx === -1) return;
    const newIndex = Math.max(0, Math.min(archives.length - 1, idx + direction));
    if (newIndex === idx) return;
    const [item] = archives.splice(idx,1);
    archives.splice(newIndex, 0, item);
    saveState(); renderLists();
    const el = findCardElementById(id); if (el) el.focus();
  }
}

// keyboard move across lists
function keyboardMoveCard(id, area, dir) {
  // dir: 'right' => pkg -> arch, arch -> pkg depending on area
  if (area === 'pkg' && dir === 'right') {
    if (CONFIRM_ON_CROSS_MOVE && !confirm('Move to Archives?')) return;
    const idx = packageItems.findIndex(i => i.id === id); if (idx === -1) return;
    const item = packageItems.splice(idx,1)[0];
    archives.push(Object.assign({}, item, { id: 'arch-' + item.id }));
    saveState(); renderLists(); flashMoved();
  } else if (area === 'arch' && dir === 'left') {
    if (CONFIRM_ON_CROSS_MOVE && !confirm('Restore to Package Category?')) return;
    const idx = archives.findIndex(i => i.id === id); if (idx === -1) return;
    const item = archives.splice(idx,1)[0];
    const restoredId = String(item.id).replace(/^arch-/,'');
    let finalId = restoredId; if (packageItems.some(p => p.id === finalId)) finalId = restoredId + '-' + Date.now();
    packageItems.push(Object.assign({}, item, { id: finalId }));
    saveState(); renderLists(); flashMoved();
  }
}

/* ======================
   Small helpers & UI utilities
   ====================== */

function flashMoved(){
  document.querySelectorAll('.pkg-card').forEach(el => {
    el.classList.remove('moved');
    setTimeout(()=> el.classList.add('moved'), 10);
    setTimeout(()=> el.classList.remove('moved'), 420);
  });
}

/* ======================
   Edit-mode helpers (click-to-edit toolbar)
   ====================== */
function toggleEditMode(area) {
  if (editMode) { exitEditMode(); return; }
  editMode = true;
  if (pkgEditBtn) pkgEditBtn.textContent = 'Cancel';
  if (archEditBtn) archEditBtn.textContent = 'Cancel';
  if (pkgCancelBtn) pkgCancelBtn.style.display = '';
  if (archCancelBtn) archCancelBtn.style.display = '';
  document.querySelectorAll('.pkg-card').forEach(c => c.style.cursor = 'crosshair');
}

function exitEditMode(){
  editMode = false;
  if (pkgEditBtn) pkgEditBtn.textContent = 'Edit';
  if (archEditBtn) archEditBtn.textContent = 'Edit';
  if (pkgCancelBtn) pkgCancelBtn.style.display = 'none';
  if (archCancelBtn) archCancelBtn.style.display = 'none';
  document.querySelectorAll('.pkg-card').forEach(c => c.style.cursor = '');
}

/* ======================
   Global handlers (modal backdrop, keyboard)
   ====================== */
if (addModal) addModal.addEventListener('click', (e) => { if (e.target === addModal) closeAddModal(); });
if (editModal) editModal.addEventListener('click', (e) => { if (e.target === editModal) closeEditModal(); });

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (selectionModePkg) cancelPkgSelection();
    if (selectionModeArch) cancelArchSelection();
    if (addModal && addModal.classList.contains('show')) closeAddModal();
    if (editModal && editModal.classList.contains('show')) closeEditModal();
    if (editMode) exitEditMode();
  }
});


loadState();
renderLists();
setupDragDrop();

const packageDetailModal = document.getElementById('packageDetailModal');
const pkgDetailName = document.getElementById('pkgDetailName');
const pkgDetailDescription = document.getElementById('pkgDetailDescription');
const pkgDetailInclusions = document.getElementById('pkgDetailInclusions');
const pkgDetailCancel = document.getElementById('pkgDetailCancel');
const pkgDetailSave = document.getElementById('pkgDetailSave');

let openFolderId = null;     // currently opened folder id
let openedFolderList = [];   // packages inside the opened folder (IDs or objects)
let currentPackageItem = null; // currently selected package in folder view

// Hook into createCard to add double-click to open folder (if not already present)
// If your createCard already has dblclick handling, update it to call openFolderView(item)
function attachFolderOpenToCard(cardEl, item) {
  // double-click opens the folder (package category or archive)
  cardEl.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    openFolderView(item);
  });
}

/* Call this when user double-clicks a folder */
function openFolderView(folderItem) {
  if (!folderItem) return;
  openFolderId = folderItem.id;
  // change topbar title (assumes you have .page-title element)
  const titleEl = document.querySelector('.page-title');
  if (titleEl) titleEl.textContent = `Package List - ${folderItem.name}`;

  // Build the folder view content
  renderFolderView(folderItem);
}

/* renderFolderView(folderItem)
   - Shows two sections: "Packages" and "Add ons"
   - For now we simply show placeholders for internal packages (you'll provide actual lists)
*/
function renderFolderView(folderItem) {
  const container = document.querySelector('.content') || document.querySelector('.page-content') || document.body;
  // create a container for the folder view (replace main content area)
  // NOTE: You can adjust the selector above to the actual main content node in your app
  let fv = document.querySelector('.folder-view');
  if (fv) fv.remove();

  fv = document.createElement('div');
  fv.className = 'folder-view';

  // header row with toolbar (Select / Add)
  const header = document.createElement('div');
  header.className = 'folder-header';
  const h1 = document.createElement('h2');
  h1.textContent = folderItem.name;
  h1.style.margin = '0';
  h1.style.fontSize = '1.4rem';
  header.appendChild(h1);

  // top-right toolbar (Select / Add)
  const toolbar = document.createElement('div');
  toolbar.className = 'folder-toolbar';
  const selectBtn = document.createElement('button');
  selectBtn.className = 'btn small';
  selectBtn.textContent = 'Select';
  const addBtn = document.createElement('button');
  addBtn.className = 'btn small primary';
  addBtn.textContent = 'Add';

  // wire simple behavior: add new package placeholder inside this folder (client-side)
  addBtn.addEventListener('click', () => {
    // produce a simple package instance (you can replace this with file upload form)
    const newPkg = {
      id: `${folderItem.id}-pkg-${Date.now()}`,
      name: 'New item',
      img: 'images/placeholder.jpg',
      description: '',
      inclusions: []
    };

    // For demo we push to an "internal" list — you must decide where to store actual subitems.
    // Here we append into an array property on folderItem to keep items per folder
    folderItem.items = folderItem.items || [];
    folderItem.items.push(newPkg);
    renderFolderItems(folderItem);
  });

  toolbar.appendChild(selectBtn);
  toolbar.appendChild(addBtn);
  header.appendChild(toolbar);
  fv.appendChild(header);

  // Section: Packages
  const secPackagesTitle = document.createElement('h3');
  secPackagesTitle.textContent = 'Packages';
  fv.appendChild(secPackagesTitle);

  const packagesGrid = document.createElement('div');
  packagesGrid.className = 'folder-grid';
  packagesGrid.id = 'folderPackagesGrid';

  // Use folderItem.items if present, otherwise show placeholders (6 boxes)
  const items = (folderItem.items && folderItem.items.length) ? folderItem.items : Array.from({length:6}).map((_,i)=>({ id:`ph-${i}`, name:'', img:'' }) );

  items.forEach(it => {
    const tile = document.createElement('div');
    tile.className = 'pkg-card';
    tile.style.minHeight = '160px';
    tile.style.display = 'flex';
    tile.style.flexDirection = 'column';
    tile.style.justifyContent = 'center';
    tile.style.alignItems = 'center';
    tile.style.gap = '8px';
    tile.style.padding = '12px';

    // image preview or empty box
    const frame = document.createElement('div');
    frame.style.width = '160px';
    frame.style.height = '160px';
    frame.style.background = '#fff';
    frame.style.boxShadow = '0 6px 12px rgba(0,0,0,0.04)';
    frame.style.border = '6px solid #f3f6f6';
    if (it.img) {
      const im = document.createElement('img');
      im.src = it.img;
      im.style.width = '100%';
      im.style.height = '100%';
      im.style.objectFit = 'cover';
      frame.appendChild(im);
    }
    tile.appendChild(frame);

    const lbl = document.createElement('div');
    lbl.textContent = it.name || 'Untitled';
    lbl.style.fontWeight = '700';
    lbl.style.textAlign = 'center';
    tile.appendChild(lbl);

    // pencil icon on top-right of the tile
    const pen = document.createElement('img');
    pen.src = 'images/packagelist/pencil.svg';
    pen.className = 'card-edit-icon';
    pen.style.position = 'absolute';
    pen.style.top = '8px';
    pen.style.right = '8px';
    pen.style.width = '20px';
    pen.style.cursor = 'pointer';
    pen.addEventListener('click', (e) => {
      e.stopPropagation();
      // open package detail modal for this item
      openPackageDetailModal(it, folderItem);
    });
    tile.appendChild(pen);

    // single-click: open package detail
    tile.addEventListener('click', () => openPackageDetailModal(it, folderItem));

    packagesGrid.appendChild(tile);
  });

  fv.appendChild(packagesGrid);

  // Section: Add ons (repeat same pattern)
  const secAddonsTitle = document.createElement('h3');
  secAddonsTitle.textContent = folderItem.name + ' - Add ons';
  fv.appendChild(secAddonsTitle);

  const addonsGrid = document.createElement('div');
  addonsGrid.className = 'folder-grid';
  addonsGrid.id = 'folderAddonsGrid';

  // placeholders (3 boxes)
  Array.from({length:3}).forEach((_,i) => {
    const t = document.createElement('div');
    t.className = 'pkg-card';
    t.style.height = '180px';
    t.textContent = ''; // user will add actual items
    addonsGrid.appendChild(t);
  });

  fv.appendChild(addonsGrid);

  // Back button to go back to top-level lists
  const backBtn = document.createElement('button');
  backBtn.className = 'btn';
  backBtn.textContent = 'Back';
  backBtn.style.marginTop = '8px';
  backBtn.addEventListener('click', () => {
    // reset topbar title
    const titleEl = document.querySelector('.page-title');
    if (titleEl) titleEl.textContent = 'Package List';
    // remove folder view and re-render lists
    const fvNode = document.querySelector('.folder-view');
    if (fvNode) fvNode.remove();
    openFolderId = null;
    renderLists();
  });

  fv.appendChild(backBtn);

  // insert folder view into DOM after your page header / inside main content area
  // find a sensible placement: either a .content node or a .page-content as used in your project
  const mainContainer = document.querySelector('.page-content') || document.querySelector('.content') || document.body;
  mainContainer.appendChild(fv);
}

/* Utility to re-render items for the opened folder (keeps the view updated) */
function renderFolderItems(folderItem) {
  const grid = document.getElementById('folderPackagesGrid');
  if (!grid) return;
  grid.innerHTML = '';
  const items = folderItem.items || [];
  items.forEach(it => {
    const tile = document.createElement('div');
    tile.className = 'pkg-card';
    tile.style.minHeight = '160px';
    tile.style.display = 'flex';
    tile.style.flexDirection = 'column';
    tile.style.justifyContent = 'center';
    tile.style.alignItems = 'center';
    tile.style.gap = '8px';
    tile.style.padding = '12px';

    const frame = document.createElement('div');
    frame.style.width = '160px';
    frame.style.height = '160px';
    frame.style.background = '#fff';
    frame.style.boxShadow = '0 6px 12px rgba(0,0,0,0.04)';
    frame.style.border = '6px solid #f3f6f6';
    if (it.img) {
      const im = document.createElement('img');
      im.src = it.img;
      im.style.width = '100%';
      im.style.height = '100%';
      im.style.objectFit = 'cover';
      frame.appendChild(im);
    }
    tile.appendChild(frame);

    const lbl = document.createElement('div');
    lbl.textContent = it.name || 'Untitled';
    lbl.style.fontWeight = '700';
    lbl.style.textAlign = 'center';
    tile.appendChild(lbl);

    const pen = document.createElement('img');
    pen.src = 'images/packagelist/pencil.svg';
    pen.className = 'card-edit-icon';
    pen.style.position = 'absolute';
    pen.style.top = '8px';
    pen.style.right = '8px';
    pen.style.width = '20px';
    pen.style.cursor = 'pointer';
    pen.addEventListener('click', (e) => { e.stopPropagation(); openPackageDetailModal(it, folderItem); });
    tile.appendChild(pen);

    tile.addEventListener('click', () => openPackageDetailModal(it, folderItem));
    grid.appendChild(tile);
  });
}

/* Package detail modal control
   - opens the modal and populates the fields (pkgDetailName etc.)
   - highlighted UI block in HTML above corresponds to these element IDs
*/
function openPackageDetailModal(pkgObj, parentFolder) {
  currentPackageItem = { pkgObj, parentFolder };
  if (pkgDetailName) pkgDetailName.value = pkgObj.name || '';
  if (pkgDetailDescription) pkgDetailDescription.value = pkgObj.description || '';
  if (pkgDetailInclusions) pkgDetailInclusions.value = Array.isArray(pkgObj.inclusions) ? pkgObj.inclusions.join('\n') : (pkgObj.inclusions || '');

  if (!packageDetailModal) return;
  packageDetailModal.classList.add('show');
  packageDetailModal.classList.remove('modal-hidden');
}

function closePackageDetailModal() {
  if (!packageDetailModal) return;
  packageDetailModal.classList.remove('show');
  // Save fields back into the in-memory object if user saved, handled by save button below
}

// save handler
if (pkgDetailSave) pkgDetailSave.addEventListener('click', () => {
  if (!currentPackageItem) return;
  const { pkgObj, parentFolder } = currentPackageItem;
  if (pkgDetailName) pkgObj.name = pkgDetailName.value.trim();
  if (pkgDetailDescription) pkgObj.description = pkgDetailDescription.value.trim();
  if (pkgDetailInclusions) {
    const lines = pkgDetailInclusions.value.split('\n').map(s => s.trim()).filter(Boolean);
    pkgObj.inclusions = lines;
  }
  // If package is stored in top-level arrays, optionally persist (not implemented here)
  // If parentFolder exists, the item was inside folderItem.items and is updated in place
  renderFolderItems(parentFolder || {});
  closePackageDetailModal();
  saveState();
});
if (pkgDetailCancel) pkgDetailCancel.addEventListener('click', closePackageDetailModal);

// allow clicking backdrop to close
if (packageDetailModal) packageDetailModal.addEventListener('click', (e) => {
  if (e.target === packageDetailModal) closePackageDetailModal();
});
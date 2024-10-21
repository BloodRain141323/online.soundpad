let sounds = {};
let db;
let currentlyPlaying = null;
let hotkeys = {};

const dbName = 'SoundpadDB';
const storeName = 'sounds';

let draggedElement = null;
let placeholder = null;

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);
        
        request.onerror = (event) => reject("IndexedDB error: " + event.target.error);

        request.onsuccess = (event) => {
            db = event.target.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            db = event.target.result;
            db.createObjectStore(storeName);
        };
    });
}

function loadSavedSounds() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly');
        const objectStore = transaction.objectStore(storeName);
        const request = objectStore.get('soundsData');

        request.onerror = (event) => reject("Error loading sounds: " + event.target.error);

        request.onsuccess = (event) => {
            const data = event.target.result || {};
            sounds = data.sounds || {};
            hotkeys = data.hotkeys || {};
            resolve();
        };
    });
}

function saveSounds() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const objectStore = transaction.objectStore(storeName);
        const request = objectStore.put({sounds, hotkeys}, 'soundsData');

        request.onerror = (event) => reject("Error saving sounds: " + event.target.error);

        request.onsuccess = (event) => resolve();
    });
}

function updateSoundButtons() {
    const baseSoundContainer = document.getElementById('base-sound-buttons');
    const customSoundContainer = document.getElementById('custom-sound-buttons');
    
    if (!baseSoundContainer || !customSoundContainer) {
        console.error('Sound containers not found');
        return;
    }
    
    baseSoundContainer.innerHTML = '';
    customSoundContainer.innerHTML = '';
    
    Object.keys(sounds).forEach((soundName, index) => {
        if (index < 9) {
            createSoundButton(soundName, index, baseSoundContainer);
        } else {
            createSoundButton(soundName, index, customSoundContainer);
        }
    });
}

function createSoundButton(soundName, index, container) {
    if (!container) {
        console.error('Container not found for sound button');
        return;
    }

    const button = document.createElement('button');
    button.id = `sound-${index}`;
    button.className = 'sound-button';
    button.textContent = soundName;
    button.onclick = () => toggleSound(soundName);
    button.draggable = true;
    button.addEventListener('dragstart', drag);
    button.addEventListener('dragend', dragEnd);
    button.addEventListener('dragover', dragOver);
    button.addEventListener('dragleave', dragLeave);
    
    const hotkeySpan = document.createElement('span');
    hotkeySpan.className = 'hotkey';
    updateHotkeySpan(hotkeySpan, soundName, index);
    button.appendChild(hotkeySpan);
    
    const deleteButton = document.createElement('button');
    deleteButton.className = 'delete-button';
    deleteButton.textContent = 'X';
    deleteButton.onclick = (e) => {
        e.stopPropagation();
        deleteSound(soundName);
    };
    
    button.appendChild(deleteButton);
    container.appendChild(button);
}

function toggleSound(soundName) {
    if (currentlyPlaying) {
        currentlyPlaying.audio.pause();
        currentlyPlaying.audio.currentTime = 0;
        
        if (currentlyPlaying.soundName === soundName) {
            currentlyPlaying = null;
            return;
        }
    }
    
    playSound(soundName);
}

function playSound(soundName) {
    const audio = new Audio(sounds[soundName]);
    audio.play();
    currentlyPlaying = { audio, soundName };
    
    audio.onended = () => {
        currentlyPlaying = null;
    };
}

function deleteSound(soundName) {
    delete sounds[soundName];
    delete hotkeys[soundName];
    saveSounds();
    updateSoundButtons();
}

function previewSounds() {
    const fileInput = document.getElementById('sound-upload');
    const selectedSoundsContainer = document.getElementById('selected-sounds');
    selectedSoundsContainer.innerHTML = '';

    for (let i = 0; i < fileInput.files.length; i++) {
        const file = fileInput.files[i];
        const soundName = file.name.split('.')[0];
        
        const soundPreview = document.createElement('div');
        soundPreview.className = 'sound-preview';
        soundPreview.textContent = soundName;
        
        selectedSoundsContainer.appendChild(soundPreview);
    }
}

function uploadSounds() {
    const fileInput = document.getElementById('sound-upload');
    const files = fileInput.files;
    let loadedFiles = 0;

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const reader = new FileReader();

        reader.onload = function(e) {
            const soundName = file.name.split('.')[0];
            sounds[soundName] = e.target.result;
            loadedFiles++;

            if (loadedFiles === files.length) {
                saveSounds();
                updateSoundButtons();
                document.getElementById('selected-sounds').innerHTML = ''; // Очищаем превью после загрузки
            }
        }

        reader.readAsDataURL(file);
    }
}

function assignHotkey(soundName) {
    const key = prompt('Введите клавишу для этого звука:');
    if (key && key.length === 1) {
        hotkeys[soundName] = key.toUpperCase();
        saveSounds();
        updateSoundButtons();
    } else {
        alert('Пожалуйста, введите одну букву или цифру.');
    }
}

function updateHotkeySpan(span, soundName, index) {
    if (hotkeys[soundName]) {
        span.textContent = `[${hotkeys[soundName]}]`;
    } else if (index < 9) {
        span.textContent = `[${index + 1}]`;
    } else {
        span.textContent = '[?]';
    }
    span.onclick = (e) => {
        e.stopPropagation();
        editHotkey(soundName);
    };
}

function drag(ev) {
    draggedElement = ev.target;
    ev.dataTransfer.setData("text/plain", ev.target.id);
    ev.target.classList.add('dragging');
    
    // Создаем плейсхолдер
    placeholder = document.createElement('div');
    placeholder.className = 'placeholder';
    placeholder.style.width = `${draggedElement.offsetWidth}px`;
    placeholder.style.height = `${draggedElement.offsetHeight}px`;
    draggedElement.parentNode.insertBefore(placeholder, draggedElement.nextSibling);

    // Задержка для визуального эффекта
    setTimeout(() => {
        draggedElement.style.display = 'none';
    }, 0);
}

function dragEnd(ev) {
    ev.target.classList.remove('dragging');
    ev.target.style.display = '';
    if (placeholder && placeholder.parentNode) {
        placeholder.parentNode.removeChild(placeholder);
    }
}

function dragOver(ev) {
    ev.preventDefault();
    const target = ev.target.closest('.sound-button');
    if (target && target !== draggedElement) {
        target.classList.add('drag-over');
    }
}

function dragLeave(ev) {
    const target = ev.target.closest('.sound-button');
    if (target) {
        target.classList.remove('drag-over');
    }
}

function drop(ev) {
    ev.preventDefault();
    const data = ev.dataTransfer.getData("text/plain");
    draggedElement = document.getElementById(data);
    const dropTarget = ev.target.closest('.sound-button');

    if (dropTarget && draggedElement !== dropTarget) {
        const draggedParent = draggedElement.parentNode;
        const dropParent = dropTarget.parentNode;

        // Сохраняем исходные данные
        const draggedSoundName = draggedElement.textContent.replace('X', '').trim();
        const dropTargetSoundName = dropTarget.textContent.replace('X', '').trim();
        const draggedHotkey = hotkeys[draggedSoundName];
        const dropTargetHotkey = hotkeys[dropTargetSoundName];

        // Меняем местами элементы
        const draggedNext = draggedElement.nextSibling;
        const dropNext = dropTarget.nextSibling;
        dropParent.insertBefore(draggedElement, dropNext);
        draggedParent.insertBefore(dropTarget, draggedNext);

        // Обмениваем хоткеи
        if (draggedParent === dropParent) {
            // Если кнопки в одной колонке, просто меняем их хоткеи местами
            hotkeys[draggedSoundName] = dropTargetHotkey;
            hotkeys[dropTargetSoundName] = draggedHotkey;
        } else {
            // Если кнопки в разных колонках
            if (draggedParent.id === 'base-sound-buttons') {
                // Если перетаскиваемая кнопка из базовых звуков
                hotkeys[dropTargetSoundName] = draggedHotkey;
                delete hotkeys[draggedSoundName];
            } else {
                // Если перетаскиваемая кнопка из дополнительных звуков
                hotkeys[draggedSoundName] = dropTargetHotkey;
                delete hotkeys[dropTargetSoundName];
            }
        }

        updateHotkeys();
    }

    // Очистка
    if (placeholder && placeholder.parentNode) {
        placeholder.parentNode.removeChild(placeholder);
    }
    draggedElement.classList.remove('dragging');
    draggedElement.style.display = '';
    if (dropTarget) {
        dropTarget.classList.remove('drag-over');
    }
    draggedElement = null;
}

function updateHotkeys() {
    const baseSoundButtons = document.getElementById('base-sound-buttons').children;
    const customSoundButtons = document.getElementById('custom-sound-buttons').children;
    
    // Обновляем хоткеи для базовых звуков
    for (let i = 0; i < baseSoundButtons.length; i++) {
        const soundName = baseSoundButtons[i].textContent.replace('X', '').trim();
        const hotkeySpan = baseSoundButtons[i].querySelector('.hotkey');
        if (!hotkeys[soundName]) {
            hotkeys[soundName] = (i + 1).toString();
        }
        updateHotkeySpan(hotkeySpan, soundName, i);
    }
    
    // Обновляем хоткеи для дополнительных звуков
    for (let i = 0; i < customSoundButtons.length; i++) {
        const soundName = customSoundButtons[i].textContent.replace('X', '').trim();
        const hotkeySpan = customSoundButtons[i].querySelector('.hotkey');
        updateHotkeySpan(hotkeySpan, soundName, i + 9);
    }
    
    saveSounds();
}

// Добавляем обработчики событий для drag-and-drop
document.getElementById('base-sound-buttons').addEventListener('dragover', allowDrop);
document.getElementById('base-sound-buttons').addEventListener('drop', drop);
document.getElementById('custom-sound-buttons').addEventListener('dragover', allowDrop);
document.getElementById('custom-sound-buttons').addEventListener('drop', drop);

document.addEventListener('keydown', function(event) {
    const key = event.key.toUpperCase();
    const soundNames = Object.keys(sounds);
    
    let soundToPlay = null;

    if (key >= '1' && key <= '9') {
        const index = parseInt(key) - 1;
        if (index < soundNames.length) {
            soundToPlay = soundNames[index];
        }
    } else {
        for (let soundName in hotkeys) {
            if (hotkeys[soundName] === key) {
                soundToPlay = soundName;
                break;
            }
        }
    }

    if (soundToPlay) {
        toggleSound(soundToPlay);
    }
});

function initApp() {
    openDB()
        .then(() => loadSavedSounds())
        .then(() => {
            updateSoundButtons();
            
            // Добавляем обработчики событий для drag-and-drop
            document.getElementById('base-sound-buttons').addEventListener('dragover', allowDrop);
            document.getElementById('base-sound-buttons').addEventListener('drop', drop);
            document.getElementById('custom-sound-buttons').addEventListener('dragover', allowDrop);
            document.getElementById('custom-sound-buttons').addEventListener('drop', drop);

            // Удаляем дублирующий обработчик событий клавиатуры
        })
        .catch(error => {
            console.error("Failed to initialize the app:", error);
            alert("Произошла ошибка при инициализации приложения. Пожалуйста, обновите страницу и попробуйте снова.");
        });
}

// Вызываем функцию инициализации при загрузке страницы
window.addEventListener('load', initApp);

function allowDrop(ev) {
    ev.preventDefault();
    const target = ev.target.closest('.sound-button');
    if (target && target !== draggedElement) {
        target.classList.add('drag-over');
    }
}

function editHotkey(soundName) {
    const currentHotkey = hotkeys[soundName] || '';
    const newHotkey = prompt(`Введите новый хоткей для звука "${soundName}":`, currentHotkey);
    if (newHotkey !== null) {
        if (newHotkey.length === 1) {
            hotkeys[soundName] = newHotkey.toUpperCase();
            saveSounds();
            updateSoundButtons();
        } else if (newHotkey === '') {
            delete hotkeys[soundName];
            saveSounds();
            updateSoundButtons();
        } else {
            alert('Пожалуйста, введите одну букву или цифру, или оставьте поле пустым, чтобы удалить хоткей.');
        }
    }
}

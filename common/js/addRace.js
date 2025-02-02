import { submitRace } from './submitRace.js';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('add-race-form');
  const multiDayToggle = document.getElementById('multi-day-toggle');
  const endDateContainer = document.getElementById('end-date-container');
  const distanceInput = document.getElementById('distance-input');
  const addDistanceButton = document.getElementById('add-distance');
  const distancesContainer = document.getElementById('distances-container');
  const raceDistancesInput = document.getElementById('race-distances');
  const quickDistanceButtons = document.querySelectorAll('.quick-distance');
  const imageUpload = document.getElementById('race-images');
  const imageContainer = document.querySelector('.image-container');
  const clearImagesButton = document.getElementById('clearImagesButton');
  const clearFormButton = document.getElementById('clear-form');
  /*   const previewButton = document.getElementById('preview-button'); */
  const submitRaceButton = document.getElementById('submit-race-button');

  let distances = [];
  let raceImagesData = JSON.parse(localStorage.getItem('raceImages')) || {
    images: [],
  };

  function saveFormToLocalStorage() {
    const formData = new FormData(form);
    const formObject = {};
    for (const [key, value] of formData.entries()) {
      formObject[key] = value;
    }
    formObject.distances = distances;
    localStorage.setItem('raceFormData', JSON.stringify(formObject));
  }

  function loadFormFromLocalStorage() {
    const savedData = localStorage.getItem('raceFormData');
    if (savedData) {
      const formObject = JSON.parse(savedData);
      for (const [key, value] of Object.entries(formObject)) {
        if (key === 'distances') {
          distances = value;
          updateDistancesDisplay();
        } else {
          const field = form.elements[key];
          if (field) {
            if (field.type === 'checkbox') {
              field.checked = value === 'on';
            } else {
              field.value = value;
            }
          }
        }
      }
    }
  }

  loadFormFromLocalStorage();

  form.querySelectorAll('input, select, textarea').forEach((element) => {
    element.addEventListener('change', saveFormToLocalStorage);
  });

  form.querySelectorAll('button').forEach((button) => {
    button.addEventListener('click', saveFormToLocalStorage);
  });

  multiDayToggle.addEventListener('change', () => {
    endDateContainer.style.display = multiDayToggle.checked ? 'block' : 'none';
  });

  addDistanceButton.addEventListener('click', () => {
    addDistance(distanceInput.value);
  });

  quickDistanceButtons.forEach((button) => {
    button.addEventListener('click', () => {
      addDistance(button.dataset.distance);
    });
  });

  function addDistance(distance) {
    if (distance) {
      distances.push(distance);
      updateDistancesDisplay();
      distanceInput.value = '';
      saveFormToLocalStorage();
    }
  }

  function updateDistancesDisplay() {
    distancesContainer.innerHTML = distances
      .map(
        (d) => `
      <div class="distance-tag">
        ${d === 'backyard' ? 'Backyard Ultra' : d + ' km'}
        <button type="button" class="remove-distance" data-distance="${d}">×</button>
      </div>
    `
      )
      .join('');
    raceDistancesInput.value = JSON.stringify(distances);

    document.querySelectorAll('.remove-distance').forEach((button) => {
      button.addEventListener('click', () => {
        distances = distances.filter((d) => d != button.dataset.distance);
        updateDistancesDisplay();
        saveFormToLocalStorage();
      });
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(form);

    // Process images
    const imageFiles = formData.getAll('race-images');
    const processedImages = await processImages(imageFiles);

    // Create race object with cleaned up keys (removing 'race-' prefix)
    const raceObject = {};
    for (const [key, value] of formData.entries()) {
      if (key.startsWith('race-')) {
        const cleanKey = key.replace('race-', '');
        raceObject[cleanKey] = value;
      } else {
        raceObject[key] = value;
      }
    }

    // Special handling for specific fields
    raceObject.date = raceObject.date.replace(/-/g, '');
    raceObject.distances = JSON.stringify(
      raceObject.distances.split(',').map((d) => d.trim())
    );
    raceObject.latitude = mapCoordinates.lat;
    raceObject.longitude = mapCoordinates.lng;
    raceObject.images = processedImages.map((img) => img.blob);

    try {
      const response = await fetch('/api/races', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(raceObject),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Success:', result);
      clearFormAndStorage();
      // Add success message or redirect here
    } catch (error) {
      console.error('Error:', error);
      // Add error handling here
    }
  });

  imageUpload.addEventListener('change', handleImageUpload);

  function handleImageUpload(event) {
    const files = event.target.files;
    const maxNumImages = 8 - raceImagesData.images.length;

    if (files.length > maxNumImages) {
      alert(`Du kan bara ladda upp ${maxNumImages} bilder till.`);
      return;
    }

    for (let i = 0; i < files.length && i < maxNumImages; i++) {
      const file = files[i];
      const reader = new FileReader();

      reader.onload = function (e) {
        raceImagesData.images.push(e.target.result);
        localStorage.setItem('raceImages', JSON.stringify(raceImagesData));
        refreshImageDisplay();
      };

      reader.readAsDataURL(file);
    }
  }

  function refreshImageDisplay() {
    imageContainer.innerHTML = '';
    raceImagesData.images.forEach((imageData, index) => {
      const imgContainer = document.createElement('div');
      imgContainer.className = 'uploaded-image-container';

      const img = document.createElement('img');
      img.src = imageData;
      img.className = 'uploaded-image';

      const deleteIcon = document.createElement('span');
      deleteIcon.className = 'delete-icon';
      deleteIcon.textContent = '×';
      deleteIcon.addEventListener('click', () => removeImage(index));

      imgContainer.appendChild(img);
      imgContainer.appendChild(deleteIcon);
      imageContainer.appendChild(imgContainer);
    });

    if (raceImagesData.images.length > 0) {
      clearImagesButton.style.display = 'block';
    } else {
      clearImagesButton.style.display = 'none';
    }
  }

  function removeImage(index) {
    raceImagesData.images.splice(index, 1);
    localStorage.setItem('raceImages', JSON.stringify(raceImagesData));
    refreshImageDisplay();
  }

  clearImagesButton.addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.removeItem('raceImages');
    raceImagesData = { images: [] };
    refreshImageDisplay();
  });

  function clearFormAndStorage() {
    form.reset();
    distances = [];
    updateDistancesDisplay();
    localStorage.removeItem('raceImages');
    raceImagesData = { images: [] };
    refreshImageDisplay();
    localStorage.removeItem('raceFormData');
  }

  if (clearFormButton) {
    clearFormButton.addEventListener('click', (e) => {
      e.preventDefault();
      clearFormAndStorage();
    });
  }

  refreshImageDisplay();

  /*   previewButton.addEventListener('click', (e) => {
    e.preventDefault();
    saveFormToLocalStorage();
    window.location.href = `/{{ auxiliary_pages['race-page-preview'] | slugify(country_code) }}.html`;
  }); */

  submitRaceButton.addEventListener('click', (e) => {
    e.preventDefault();
    saveFormToLocalStorage();
    submitRace();
  });
});

async function processImages(imageFiles) {
  const processedImages = [];
  for (const file of imageFiles) {
    const resizedImage = await resizeImage(file, 1000); // Max width 1000px
    const webpBlob = await convertToWebP(resizedImage);
    const compressedWebP = await compressImage(webpBlob, 500 * 1024); // 500 KB limit
    processedImages.push({
      name: `${file.name.split('.')[0]}.webp`,
      blob: compressedWebP,
    });
  }
  return processedImages;
}

function resizeImage(file, maxWidth) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = maxWidth / img.width;
        canvas.width = maxWidth;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(resolve, 'image/jpeg', 0.9);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function convertToWebP(blob) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(resolve, 'image/webp', 0.9);
    };
    img.src = URL.createObjectURL(blob);
  });
}

async function compressImage(blob, maxSizeInBytes) {
  let quality = 0.9;
  let compressedBlob = blob;

  while (compressedBlob.size > maxSizeInBytes && quality > 0.1) {
    quality -= 0.1;
    compressedBlob = await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(resolve, 'image/webp', quality);
      };
      img.src = URL.createObjectURL(blob);
    });
  }

  return compressedBlob;
}

 // PAN / SCROLL CANVAS
 canvasContainer.addEventListener('mousedown', (e) => {
    // Only pan if clicking directly on canvas-container or svg (not on blocks)
    if (e.target === canvasContainer || e.target.tagName === 'svg' || e.target.tagName === 'path') {
      isPanning = true;
      panStartX = e.clientX + window.scrollX;
      panStartY = e.clientY + window.scrollY;
      canvasContainer.classList.add('panning');
    }
  });

  document.addEventListener('mousemove', (e) => {
    if (!isPanning) return;

    const x = e.clientX + window.scrollX;
    const y = e.clientY + window.scrollY;

    window.scrollTo(
      panStartX - e.clientX,
      panStartY - e.clientY
    );
  });

  document.addEventListener('mouseup', () => {
    isPanning = false;
    canvasContainer.classList.remove('panning');
  });


// ZOOM CANVAS
document.addEventListener('wheel', (e) => {
    if (e.ctrlKey) {
      e.preventDefault();
      const zoomSpeed = 0.1;
      if (e.deltaY < 0) {
        zoomLevel = Math.min(zoomLevel + zoomSpeed, 3); // max 300%
      } else {
        zoomLevel = Math.max(zoomLevel - zoomSpeed, 0.2); // min 20%
      }
      canvasContainer.style.transform = `scale(${zoomLevel})`;
      redrawWires();
    }
  }, { passive: false });
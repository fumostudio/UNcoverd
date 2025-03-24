document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const imageUpload = document.getElementById('imageUpload');
    const imagePreview = document.getElementById('imagePreview');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const outputContainer = document.getElementById('outputContainer');
    const outputCanvas = document.getElementById('outputCanvas');
    const uploadContainer = document.querySelector('.upload-container');
    
    const colorThief = new ColorThief();
    let uploadedImage = null;
    let currentPalette = [];
    let imageIsDark = false;
    
    // Constants
    const CANVAS_WIDTH = 1080;
    const CANVAS_HEIGHT = 1350;
    const SWATCH_RADIUS = 70;
    const ROW_SPACING = 220;
    const ROWS_Y_START = 740;
    const SWATCH_SPACING = 70;
    const SWATCHES_PER_ROW = 3;
    const TOTAL_COLORS = 9;
    const DEFAULT_BACKGROUND = '#EDD286';
    const DARK_TEXT = '#2c3e50';
    const LIGHT_TEXT = '#ffffff';
    
    // Event Listeners
    imageUpload.addEventListener('change', handleFileUpload);
    analyzeBtn.addEventListener('click', analyzeImage);
    downloadBtn.addEventListener('click', downloadImage);
    
    // Drag and drop events
    uploadContainer.addEventListener('dragover', handleDragOver);
    uploadContainer.addEventListener('dragleave', handleDragLeave);
    uploadContainer.addEventListener('drop', handleDrop);
    
    // Functions
    function handleFileUpload(e) {
        const file = e.target.files?.[0];
        if (!file) return;
        
        // Validate file type
        if (!file.type.match('image.*')) {
            alert('Please upload an image file (JPEG, PNG, etc.)');
            return;
        }
        
        const reader = new FileReader();
        
        reader.onload = function(event) {
            imagePreview.src = event.target.result;
            imagePreview.style.display = 'block';
            uploadedImage = imagePreview;
            outputContainer.style.display = 'none';
            analyzeBtn.disabled = false;
        };
        
        reader.onerror = function() {
            alert('Error reading file. Please try another image.');
        };
        
        reader.readAsDataURL(file);
    }
    
    function handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        uploadContainer.classList.add('dragover');
    }
    
    function handleDragLeave() {
        uploadContainer.classList.remove('dragover');
    }
    
    function handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        handleDragLeave();
        
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            imageUpload.files = e.dataTransfer.files;
            const event = new Event('change');
            imageUpload.dispatchEvent(event);
        }
    }
    
    function analyzeImage() {
        if (!uploadedImage) {
            alert('Please upload an image first');
            return;
        }
        
        try {
            if (uploadedImage.complete) {
                processImage();
            } else {
                uploadedImage.addEventListener('load', processImage);
            }
        } catch (e) {
            alert('Error analyzing image. Make sure it\'s loaded properly.');
            console.error('Image analysis error:', e);
        }
    }
    
    function processImage() {
        try {
            currentPalette = colorThief.getPalette(uploadedImage, TOTAL_COLORS) || [];
            if (currentPalette.length === 0) {
                throw new Error('Could not extract colours from image');
            }
            
            imageIsDark = isImageDark(uploadedImage);
            createOutputImage();
            outputContainer.style.display = 'block';
            downloadBtn.disabled = false;
        } catch (e) {
            alert('Error processing image. Please try another image.');
            console.error('Image processing error:', e);
        }
    }
    
    function isImageDark(img) {
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = 16;
            canvas.height = 16;
            
            ctx.drawImage(img, 0, 0, 16, 16);
            
            const imageData = ctx.getImageData(0, 0, 16, 16).data;
            let totalBrightness = 0;
            
            for (let i = 0; i < imageData.length; i += 4) {
                totalBrightness += (imageData[i] * 299 + imageData[i+1] * 587 + imageData[i+2] * 114) / 1000;
            }
            
            const avgBrightness = totalBrightness / (imageData.length / 4);
            return avgBrightness < 128;
        } catch (e) {
            console.error('Brightness detection error:', e);
            return false;
        }
    }
    
    function createOutputImage() {
        const ctx = outputCanvas.getContext('2d');
        
        // Set canvas dimensions
        outputCanvas.width = CANVAS_WIDTH;
        outputCanvas.height = CANVAS_HEIGHT;
        
        // Clear canvas with background color
        ctx.fillStyle = DEFAULT_BACKGROUND;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        
        // Draw source image with proper cropping
        drawSourceImage(ctx);
        
        // Draw color palette
        drawColorPalette(ctx);
    }
    
    function drawSourceImage(ctx) {
        const imgRatio = uploadedImage.naturalWidth / uploadedImage.naturalHeight;
        const canvasRatio = CANVAS_WIDTH / CANVAS_HEIGHT;
        
        let srcX = 0, srcY = 0, srcWidth = uploadedImage.naturalWidth, srcHeight = uploadedImage.naturalHeight;
        
        if (imgRatio > canvasRatio) {
            // Image is wider than canvas - crop sides
            const scale = CANVAS_HEIGHT / uploadedImage.naturalHeight;
            srcX = (uploadedImage.naturalWidth - (CANVAS_WIDTH / scale)) / 2;
            srcWidth = CANVAS_WIDTH / scale;
        } else {
            // Image is taller than canvas - crop top/bottom
            const scale = CANVAS_WIDTH / uploadedImage.naturalWidth;
            srcY = (uploadedImage.naturalHeight - (CANVAS_HEIGHT / scale)) / 2;
            srcHeight = CANVAS_HEIGHT / scale;
        }
        
        // Draw the image centered and cropped
        ctx.drawImage(
            uploadedImage, 
            srcX, srcY, srcWidth, srcHeight,
            0, 0, CANVAS_WIDTH, CANVAS_HEIGHT
        );
    }
    
    function drawColorPalette(ctx) {
        const toneRows = [
            { yPos: ROWS_Y_START },
            { yPos: ROWS_Y_START + ROW_SPACING },
            { yPos: ROWS_Y_START + ROW_SPACING * 2 }
        ];
        
        const borderColor = imageIsDark ? LIGHT_TEXT : DARK_TEXT;
        
        for (let i = 0; i < toneRows.length; i++) {
            const rowColors = currentPalette.slice(i * SWATCHES_PER_ROW, (i + 1) * SWATCHES_PER_ROW);
            if (rowColors.length === 0) continue;
            
            const row = toneRows[i];
            drawSwatches(ctx, rowColors, row.yPos, borderColor);
        }
    }
    
    function drawSwatches(ctx, colors, yPos, borderColor) {
        const totalSwatchWidth = colors.length * (SWATCH_RADIUS * 2) + 
                               (colors.length - 1) * SWATCH_SPACING;
        const startX = (CANVAS_WIDTH - totalSwatchWidth) / 2;
        
        colors.forEach((color, i) => {
            const x = startX + i * (SWATCH_RADIUS * 2 + SWATCH_SPACING) + SWATCH_RADIUS;
            const hex = rgbToHex(color[0], color[1], color[2]);
            
            // Draw glow effect
            drawGlow(ctx, x, yPos, hex);
            
            // Draw circle
            ctx.beginPath();
            ctx.arc(x, yPos, SWATCH_RADIUS, 0, Math.PI * 2);
            ctx.fillStyle = hex;
            ctx.fill();
            
            // Add outline
            ctx.lineWidth = 4;
            ctx.strokeStyle = borderColor;
            ctx.stroke();
        });
    }
    
    function drawGlow(ctx, x, y, color) {
        const gradient = ctx.createRadialGradient(
            x, y, SWATCH_RADIUS * 0.7,
            x, y, SWATCH_RADIUS * 1.3
        );
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, SWATCH_RADIUS * 1.3, 0, Math.PI * 2);
        ctx.fill();
    }
    
    function downloadImage() {
        try {
            const link = document.createElement('a');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            link.download = `palette-${timestamp}.png`;
            link.href = outputCanvas.toDataURL('image/png');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (e) {
            alert('Error downloading image. Please try again.');
            console.error('Download error:', e);
        }
    }
    
    // Helper functions
    function rgbToHex(r, g, b) {
        return '#' + [r, g, b].map(x => {
            return x.toString(16).padStart(2, '0');
        }).join('');
    }
});

// Wait for the DOM to be fully loaded
window.onload = () => {
    console.log("Window loaded, starting Matrix Rain setup...");

    // Dynamically create and append the canvas to the body
    const canvas = document.createElement('canvas');
    canvas.id = 'matrix-rain-canvas'; // Add an ID for easier debugging
    canvas.style.position = 'fixed'; // Use fixed to ensure it stays in the background
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.backgroundColor = 'black';
    canvas.style.zIndex = '-1';
    document.body.insertBefore(canvas, document.body.firstChild);
    console.log("Canvas created and appended to body:", canvas);

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error("Failed to get 2D context for canvas.");
        return;
    }
    console.log("Canvas context obtained:", ctx);

    // Set canvas dimensions to match the full scrollable document height
    const resizeCanvas = () => {
        // Use the full document height, including scrollable area
        const docHeight = Math.max(
            document.body.scrollHeight,
            document.documentElement.scrollHeight,
            document.body.offsetHeight,
            document.documentElement.offsetHeight,
            document.body.clientHeight,
            document.documentElement.clientHeight
        );

        // Adjust for device pixel ratio to prevent scaling issues
        const dpr = window.devicePixelRatio || 1;
        canvas.width = window.innerWidth * dpr;
        canvas.height = docHeight * dpr;
        ctx.scale(dpr, dpr); // Scale the context to match DPR

        // Set the CSS height to match the document height in pixels
        canvas.style.height = `${docHeight}px`;
        console.log("Canvas resized to:", canvas.width, "x", canvas.height, "with DPR:", dpr, "CSS height:", canvas.style.height);
    };
    resizeCanvas();

    // Matrix rain setup
    const squareSize = 10; // Size of the square
    let columns = Math.floor(window.innerWidth / squareSize);
    let drops = Array(columns).fill(1);
    console.log("Matrix rain initialized with", columns, "columns");

    // Animation speed control
    const speedFactor = 3; // Slow down the animation: update drops every 3 frames
    let frameCount = 0;

    // Animation loop
    const draw = () => {
        try {
            // Fade effect
            ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Set color for squares
            ctx.fillStyle = 'rgba(0, 222, 0, 0.6)';

            // Get the current scroll position
            const scrollY = window.scrollY || window.pageYOffset;

            // Use the full document height for reset condition
            const docHeight = Math.max(
                document.body.scrollHeight,
                document.documentElement.scrollHeight,
                document.body.offsetHeight,
                document.documentElement.offsetHeight,
                document.body.clientHeight,
                document.documentElement.clientHeight
            );

            // Update drops based on speed factor
            frameCount++;
            if (frameCount % speedFactor === 0) {
                // Draw squares
                for (let i = 0; i < drops.length; i++) {
                    // Adjust the y-position based on the scroll offset
                    const yPos = (drops[i] * squareSize) - scrollY;
                    // Only draw if the square is within the viewport
                    if (yPos >= -squareSize && yPos <= window.innerHeight) {
                        ctx.fillRect(i * squareSize, yPos, squareSize - 2, squareSize - 2);
                    }

                    // Reset drop when it reaches the bottom of the document
                    if (drops[i] * squareSize > docHeight && Math.random() > 0.975) {
                        drops[i] = 0;
                    }
                    drops[i]++;
                }
            }

            console.log("Matrix Rain frame rendered...");
            requestAnimationFrame(draw);
        } catch (error) {
            console.error("Error in draw loop:", error);
        }
    };

    // Start the animation
    console.log("Starting Matrix Rain animation...");
    draw();

    // Handle window resize and scroll
    const handleResizeOrScroll = () => {
        resizeCanvas();
        // Recalculate columns and reset drops
        const newColumns = Math.floor(window.innerWidth / squareSize);
        if (newColumns !== columns) {
            columns = newColumns;
            drops = Array(columns).fill(1);
            console.log("Columns updated to:", columns);
        }
    };

    window.addEventListener('resize', handleResizeOrScroll);
    window.addEventListener('scroll', handleResizeOrScroll);
};

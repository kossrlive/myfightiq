class Controls {
    constructor() {
        this.keys = {};
        window.addEventListener('keydown', (e) => {
            this.keys[e.key.toLowerCase()] = true;
            // Handle Cyrillic WASD equivalents (ц, ы, а, в)
            if (e.key === 'ц') this.keys['w'] = true;
            if (e.key === 'ы') this.keys['s'] = true;
            if (e.key === 'ф') this.keys['a'] = true;
            if (e.key === 'в') this.keys['d'] = true;
            if (e.key === 'а') this.keys['f'] = true;
        });
        
        window.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
            // Handle Cyrillic WASD equivalents
            if (e.key === 'ц') this.keys['w'] = false;
            if (e.key === 'ы') this.keys['s'] = false;
            if (e.key === 'ф') this.keys['a'] = false;
            if (e.key === 'в') this.keys['d'] = false;
            if (e.key === 'а') this.keys['f'] = false;
        });
    }

    isPressed(key) {
        return this.keys[key.toLowerCase()] === true;
    }
}
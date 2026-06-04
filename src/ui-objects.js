'use strict';

class EmitterButton {
    constructor(id, label) {
        this.id = id;
        this.label = label;
        this.rect = { x: 0, y: 0, width: 0, height: 0 };
        this.state = 'normal';
        this.isUsed = false;
        this.usedColor = null;
        this._cornerRadius = 4;
    }

    updateRect(cellWidth, cellHeight, gap, visualCols, visualRows, padding) {
        if (padding === undefined) padding = 0;
        this.rect.width = cellWidth;
        this.rect.height = cellHeight;
        const posPrefix = this.id[0];
        const posNum = parseInt(this.id.substring(1)) - 1;

        switch (posPrefix) {
            case 'T':
                this.rect.x = padding + (posNum + 1) * (cellWidth + gap);
                this.rect.y = padding;
                break;
            case 'B':
                this.rect.x = padding + (posNum + 1) * (cellWidth + gap);
                this.rect.y = padding + (visualRows + 1) * (cellHeight + gap);
                break;
            case 'L':
                this.rect.x = padding;
                this.rect.y = padding + (posNum + 1) * (cellHeight + gap);
                break;
            case 'R':
                this.rect.x = padding + (visualCols + 1) * (cellWidth + gap);
                this.rect.y = padding + (posNum + 1) * (cellHeight + gap);
                break;
        }
    }

    isInside(x, y) {
        return x >= this.rect.x && x <= this.rect.x + this.rect.width &&
               y >= this.rect.y && y <= this.rect.y + this.rect.height;
    }

    _createRoundRectPath(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        if (width < 2 * radius) radius = width / 2;
        if (height < 2 * radius) radius = height / 2;
        ctx.moveTo(x + radius, y);
        ctx.arcTo(x + width, y, x + width, y + height, radius);
        ctx.arcTo(x + width, y + height, x, y + height, radius);
        ctx.arcTo(x, y + height, x, y, radius);
        ctx.arcTo(x, y, x + width, y, radius);
        ctx.closePath();
    }

    draw(ctx, isSelected) {
        ctx.save();

        const bgColor = this.isUsed && this.usedColor ? this.usedColor : '#4a627a';

        this._createRoundRectPath(ctx, this.rect.x, this.rect.y, this.rect.width, this.rect.height, this._cornerRadius);
        ctx.fillStyle = bgColor;
        ctx.fill();

        if (isSelected) {
            ctx.strokeStyle = '#f1c40f';
            ctx.lineWidth = 3;
            ctx.shadowColor = '#f1c40f';
            ctx.shadowBlur = 8;
            ctx.stroke();
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
        } else if (this.state === 'focused') {
            ctx.strokeStyle = '#3498db';
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        const getContrast = (colorStr) => {
            if (!colorStr) return '#ecf0f1';
            let r = 0, g = 0, b = 0;
            try {
                if (colorStr.startsWith('#')) {
                    let hex = colorStr.substring(1);
                    if (hex.length === 3) {
                        hex = hex.split('').map(char => char + char).join('');
                    }
                    if (hex.length !== 6) return '#ecf0f1';
                    r = parseInt(hex.substring(0, 2), 16);
                    g = parseInt(hex.substring(2, 4), 16);
                    b = parseInt(hex.substring(4, 6), 16);
                } else if (colorStr.startsWith('rgb')) {
                    const parts = colorStr.substring(colorStr.indexOf('(') + 1, colorStr.lastIndexOf(')')).split(/,\s*/);
                    r = parseInt(parts[0]);
                    g = parseInt(parts[1]);
                    b = parseInt(parts[2]);
                } else {
                    return '#ecf0f1';
                }
            } catch (e) {
                return '#ecf0f1';
            }
            if (isNaN(r) || isNaN(g) || isNaN(b)) return '#ecf0f1';
            const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
            return (yiq >= 149) ? '#2c3e50' : '#ecf0f1';
        };

        const textColor = getContrast(bgColor);
        ctx.fillStyle = textColor;
        ctx.font = `bold ${this.rect.height * 0.45}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.label, this.rect.x + this.rect.width / 2, this.rect.y + this.rect.height / 2);

        ctx.restore();
    }
}

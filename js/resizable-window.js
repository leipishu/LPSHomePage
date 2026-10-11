(function () {
    'use strict';

    class ResizableWindow {
        constructor(element, options = {}) {
            if (!element) throw new Error('ResizableWindow: element is required');

            this.el = element;
            this.edgeSize = options.edgeSize ?? 8;
            this.minWidth = options.minWidth ?? 100;
            this.minHeight = options.minHeight ?? 100;
            this.maxWidth = options.maxWidth ?? Infinity;
            this.maxHeight = options.maxHeight ?? Infinity;

            this.resizing = false;
            this.direction = null;
            this.startX = 0;
            this.startY = 0;
            this.startRect = null;
            this.pointerId = null;

            // 从 CSS 变量读取光标值，读不到则用默认值
            const rootStyle = getComputedStyle(document.documentElement);
            const getVar = (name, fallback) => rootStyle.getPropertyValue(name).trim() || fallback;

            this.cursors = {
                n: getVar('--cursor-resize-n', 'ns-resize'),
                s: getVar('--cursor-resize-s', 'ns-resize'),
                e: getVar('--cursor-resize-e', 'ew-resize'),
                w: getVar('--cursor-resize-w', 'ew-resize'),
                ne: getVar('--cursor-resize-ne', 'nesw-resize'),
                nw: getVar('--cursor-resize-nw', 'nwse-resize'),
                se: getVar('--cursor-resize-se', 'nwse-resize'),
                sw: getVar('--cursor-resize-sw', 'nesw-resize'),
            };

            // 防止触摸拖动时页面滚动
            this.el.style.touchAction = 'none';

            this.onPointerMove = this.onPointerMove.bind(this);
            this.onPointerDown = this.onPointerDown.bind(this);
            this.onPointerUp = this.onPointerUp.bind(this);
            this.onPointerLeave = this.onPointerLeave.bind(this);

            this.el.addEventListener('pointermove', this.onPointerMove);
            this.el.addEventListener('pointerdown', this.onPointerDown);
            this.el.addEventListener('pointerup', this.onPointerUp);
            this.el.addEventListener('pointercancel', this.onPointerUp);
            this.el.addEventListener('pointerleave', this.onPointerLeave);
        }

        getDirection(clientX, clientY) {
            const rect = this.el.getBoundingClientRect();
            const x = clientX - rect.left;
            const y = clientY - rect.top;
            const { width, height } = rect;
            const edge = this.edgeSize;

            const isLeft = x < edge;
            const isRight = x > width - edge;
            const isTop = y < edge;
            const isBottom = y > height - edge;

            if (isTop && isLeft) return 'nw';
            if (isTop && isRight) return 'ne';
            if (isBottom && isLeft) return 'sw';
            if (isBottom && isRight) return 'se';
            if (isLeft) return 'w';
            if (isRight) return 'e';
            if (isTop) return 'n';
            if (isBottom) return 's';
            return null;
        }

        onPointerMove(e) {
            if (this.resizing) {
                this.handleResize(e);
                return;
            }

            const dir = this.getDirection(e.clientX, e.clientY);
            this.el.style.cursor = dir ? this.cursors[dir] : '';
        }

        onPointerDown(e) {
            const dir = this.getDirection(e.clientX, e.clientY);
            if (!dir) return;

            e.preventDefault();

            this.resizing = true;
            this.direction = dir;
            this.startX = e.clientX;
            this.startY = e.clientY;
            this.startRect = {
                left: this.el.offsetLeft,
                top: this.el.offsetTop,
                width: this.el.offsetWidth,
                height: this.el.offsetHeight,
            };
            this.pointerId = e.pointerId;

            try {
                this.el.setPointerCapture(e.pointerId);
            } catch (_) {}

            this.el.style.cursor = this.cursors[dir];
            document.body.style.userSelect = 'none';
        }

        onPointerUp(e) {
            if (!this.resizing) return;

            this.resizing = false;
            this.direction = null;

            if (this.pointerId !== null) {
                try {
                    this.el.releasePointerCapture(this.pointerId);
                } catch (_) {}
                this.pointerId = null;
            }

            document.body.style.userSelect = '';

            const dir = this.getDirection(e.clientX, e.clientY);
            this.el.style.cursor = dir ? this.cursors[dir] : '';
        }

        onPointerLeave() {
            if (this.resizing) return;
            this.el.style.cursor = '';
        }

        handleResize(e) {
            const dx = e.clientX - this.startX;
            const dy = e.clientY - this.startY;
            const dir = this.direction;
            const start = this.startRect;

            let newLeft = start.left;
            let newTop = start.top;
            let newWidth = start.width;
            let newHeight = start.height;

            if (dir.includes('e')) {
                newWidth = start.width + dx;
            }
            if (dir.includes('w')) {
                newWidth = start.width - dx;
                newLeft = start.left + dx;
            }
            if (dir.includes('s')) {
                newHeight = start.height + dy;
            }
            if (dir.includes('n')) {
                newHeight = start.height - dy;
                newTop = start.top + dy;
            }

            // 最小尺寸限制
            if (newWidth < this.minWidth) {
                if (dir.includes('w')) {
                    newLeft = start.left + start.width - this.minWidth;
                }
                newWidth = this.minWidth;
            }
            if (newHeight < this.minHeight) {
                if (dir.includes('n')) {
                    newTop = start.top + start.height - this.minHeight;
                }
                newHeight = this.minHeight;
            }

            // 最大尺寸限制
            if (newWidth > this.maxWidth) {
                if (dir.includes('w')) {
                    newLeft = start.left + start.width - this.maxWidth;
                }
                newWidth = this.maxWidth;
            }
            if (newHeight > this.maxHeight) {
                if (dir.includes('n')) {
                    newTop = start.top + start.height - this.maxHeight;
                }
                newHeight = this.maxHeight;
            }

            this.el.style.left = `${newLeft}px`;
            this.el.style.top = `${newTop}px`;
            this.el.style.width = `${newWidth}px`;
            this.el.style.height = `${newHeight}px`;
        }

        destroy() {
            this.el.removeEventListener('pointermove', this.onPointerMove);
            this.el.removeEventListener('pointerdown', this.onPointerDown);
            this.el.removeEventListener('pointerup', this.onPointerUp);
            this.el.removeEventListener('pointercancel', this.onPointerUp);
            this.el.removeEventListener('pointerleave', this.onPointerLeave);
            document.body.style.userSelect = '';
            this.el.style.cursor = '';
        }
    }

    window.ResizableWindow = ResizableWindow;
})();
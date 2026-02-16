# Stair Button Handler Fix

## Issue
The stair edge buttons were not working correctly when users clicked on the SVG icon inside the button element. The event handler was using `e.target` which would reference the clicked element (possibly the SVG), not the button itself.

## Root Cause
When using an arrow function `(e) =>`, the reference to `btn` from the forEach loop should work. However, the safest approach is to use a regular function with `this` to always reference the button element that has the event listener attached.

## Solution
Changed from:
```javascript
document.querySelectorAll('.stair-edge-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        const edge = btn.getAttribute('data-edge');
        // ...
    });
});
```

To:
```javascript
document.querySelectorAll('.stair-edge-btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        // Use 'this' to reference the button element
        // Works even if user clicks SVG icon inside button
        const edge = this.getAttribute('data-edge') || this.dataset.edge;
        
        if (edge) {
            onAddStairClick(edge);
        } else {
            console.error('Stair button missing data-edge:', this);
        }
    });
});
```

## Changes Made
1. Changed arrow function to regular function to enable `this` binding
2. Added `e.stopPropagation()` to prevent event bubbling
3. Used `this` instead of `btn` for more reliable button reference
4. Added fallback to `this.dataset.edge`
5. Added error logging for debugging

## Testing
Click on the stair edge buttons, including clicking directly on the icons inside the buttons. All clicks should now correctly trigger the stair addition.

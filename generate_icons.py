#!/usr/bin/env python3
"""
Generate extension icons in PNG format
Requires: pip install pillow
"""

from PIL import Image, ImageDraw, ImageFont
import os

def create_gradient_background(size):
    """Create a purple gradient background"""
    img = Image.new('RGB', (size, size))
    draw = ImageDraw.Draw(img)

    # Create gradient from #667eea to #764ba2
    for y in range(size):
        # Interpolate colors
        ratio = y / size
        r = int(102 + (118 - 102) * ratio)
        g = int(126 + (75 - 126) * ratio)
        b = int(234 + (162 - 234) * ratio)

        draw.line([(0, y), (size, y)], fill=(r, g, b))

    return img

def create_icon(size, output_path):
    """Create an icon of specified size"""
    img = create_gradient_background(size)
    draw = ImageDraw.Draw(img)

    # Try to use a nice font, fall back to default if not available
    try:
        if size >= 48:
            font_size = size // 4
            font = ImageFont.truetype("arial.ttf", font_size)
        else:
            font_size = size // 2
            font = ImageFont.truetype("arial.ttf", font_size)
    except:
        font = ImageFont.load_default()

    # Draw text
    if size >= 48:
        text = "A→中"
    else:
        text = "A"

    # Get text bounding box for centering
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]

    # Center the text
    x = (size - text_width) // 2
    y = (size - text_height) // 2 - bbox[1]

    # Draw white text with shadow for depth
    # Shadow
    draw.text((x+2, y+2), text, font=font, fill=(0, 0, 0, 128))
    # Main text
    draw.text((x, y), text, font=font, fill=(255, 255, 255))

    # Save
    img.save(output_path, 'PNG')
    print(f"Created {output_path}")

def main():
    # Get the icons directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    icons_dir = os.path.join(script_dir, 'icons')

    # Create icons directory if it doesn't exist
    os.makedirs(icons_dir, exist_ok=True)

    # Generate all three icon sizes
    sizes = [16, 48, 128]

    print("Generating extension icons...")
    for size in sizes:
        output_path = os.path.join(icons_dir, f'icon{size}.png')
        create_icon(size, output_path)

    print("\n✓ All icons generated successfully!")
    print(f"Icons saved to: {icons_dir}")
    print("\nNext steps:")
    print("1. Reload the extension in Chrome (chrome://extensions/)")
    print("2. You should now see the custom icons!")

if __name__ == '__main__':
    try:
        main()
    except ImportError:
        print("Error: PIL (Pillow) not found.")
        print("Please install it with: pip install pillow")
        print("\nAlternatively, use the HTML icon generator:")
        print("Open icons/generate-icons.html in your browser")

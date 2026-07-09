const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');

// Register Lemon Milk font
const fontsDir = path.join(__dirname, '..', 'assets', 'fonts');
try {
  // Register Bold Italic as the primary 'Lemon Milk' family
  GlobalFonts.registerFromPath(path.join(fontsDir, 'LEMONMILK-BoldItalic.otf'), 'Lemon Milk');
  console.log("Registered Lemon Milk Bold Italic font successfully.");
} catch (e) {
  console.error("Failed to register font:", e);
}

async function generateTestCard() {
  const templatePath = '/home/home/Downloads/CricTemplate.jpeg';
  const template = await loadImage(templatePath);
  const width = template.width;
  const height = template.height;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // 1. Draw background
  ctx.drawImage(template, 0, 0, width, height);

  // Stats for Ishan Kishan
  const name = "Ishan Kishan".toUpperCase();
  const batting = "85";
  const bowling = "25";
  const ovr = "85";

  // Calculations for font sizes:
  // Let batting/bowling rating size be 110px.
  const battingBowlingSize = 110;
  // Overall rating text size is 10% less than batting/bowling size (110 * 0.9 = 99px).
  const overallSize = battingBowlingSize * 0.9;
  // Name text size is 40% lesser than batting/bowling size (110 * 0.6 = 66px).
  const nameSize = battingBowlingSize * 0.6;

  // Coordinates:
  // Name: center horizontally, Y lowered by 10px (was 1010 -> now 1020)
  const nameX = 542.5;
  const nameY = 1020;

  // Batting: center of left box (X = 200, Y = 1225)
  const battingX = 200;
  const battingY = 1225;

  // Bowling: center of right box (X = 860, Y = 1225)
  const bowlingX = 860;
  const bowlingY = 1225;

  // Overall: center of middle circle (X = 542.5, Y shifted up by 7px: was 1260 -> now 1253)
  const ovrX = 542.5;
  const ovrY = 1253;

  // Helper function to draw gradient text with black outline using registered Lemon Milk font
  function drawGradientText(text, x, y, fontSize, align = 'center') {
    ctx.save();
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    
    // Use the registered font directly without synthetic styling to keep it clean
    ctx.font = `${fontSize}px "Lemon Milk"`;

    // Create vertical gradient
    const yStart = y - fontSize / 2;
    const yEnd = y + fontSize / 2;
    const grad = ctx.createLinearGradient(0, yStart, 0, yEnd);
    grad.addColorStop(0, '#ffffff'); // Top is white
    grad.addColorStop(1, '#ff1a1a'); // Bottom is red

    // Stroke outline
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = Math.max(6, fontSize * 0.08); // proportional line width
    ctx.lineJoin = 'miter';
    ctx.miterLimit = 2;
    ctx.strokeText(text, x, y);

    // Fill gradient
    ctx.fillStyle = grad;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  // Draw Player Name
  drawGradientText(name, nameX, nameY, nameSize);

  // Draw Batting Rating
  drawGradientText(batting, battingX, battingY, battingBowlingSize);

  // Draw Bowling Rating
  drawGradientText(bowling, bowlingX, bowlingY, battingBowlingSize);

  // Draw Overall Rating
  drawGradientText(ovr, ovrX, ovrY, overallSize);

  const outputPath = path.join(__dirname, '..', 'scratch', 'ishan_kishan_test.jpg');
  fs.writeFileSync(outputPath, canvas.toBuffer('image/jpeg', 95));
  console.log(`Successfully generated updated test card at ${outputPath}`);
}

generateTestCard().catch(console.error);

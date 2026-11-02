# 14 · แคตตาล็อกพรีเซ็ตตั้งต้น

> ค่าตัวเลขอยู่ที่ `seed/builtin-presets.json` และพร้อมต์แบบโครงสร้างอยู่ที่ `seed/structured-prompts/*.sgp.txt` (สร้างด้วย serializer อ้างอิง ทุกไฟล์อ่านกลับได้ค่าเดิมทุกพารามิเตอร์) แต่ละพรีเซ็ตแสดงพร้อมต์ต้นฉบับแบบเขียนอิสระคู่กับแบบโครงสร้าง เพื่อใช้เป็นตัวอย่างการแปลง

## ทุ่งเขียว Cinematic (`builtin:b1`)

แท็ก: ทิวทัศน์, cinematic · ไฟล์: `seed/structured-prompts/landscape-teal-cinematic.sgp.txt`

<details><summary>พร้อมต์ต้นฉบับ (เขียนอิสระ)</summary>

```text
A natural, cinematic photograph based on the landscape, balancing cool cinematic tones with a very subtle, restrained touch of warmth. The lush fields are primarily graded with a deep, cinematic teal-green and forest green. Introduce only a very slight, natural hint of warm olive and soft golden-green strictly in the sunlit patches, carefully avoiding any heavy yellow, orange, or amber color casts over the entire image. The lighting is soft and natural, resembling gentle afternoon light rather than a heavy golden hour. The highlights on the riverbanks, paths, and upper foliage have a faint, delicate warm cream tone. A gentle atmospheric haze softens the distant background with a neutral, slightly cool desaturated tone. The shadows remain deep and rich, retaining a subtle cool dark-teal undertone to provide beautiful color contrast against the delicate warm highlights, ensuring the overall image does not look overly yellow. The foreground remains grounded with a low-contrast organic film texture and a gentle vignette darkening the edges. No new elements, heavy fog overlays, or structures are added. Camera perspective, composition, and all physical elements remain completely unchanged.
```

</details>

**พร้อมต์แบบโครงสร้าง**

```text
# ชื่อ: ทุ่งเขียว Cinematic
# แท็ก: ทิวทัศน์, cinematic
# รุ่นรูปแบบ: 1

[แสง]
คอนทราสต์: แข็งขึ้น นิดเดียว (+5)
เงา: ลึก ปานกลาง (-35)

[สี]
ความอิ่มสี: จาง นิดเดียว (-5)
กันเหลือง: มาก (65)

[ใบไม้]
ใบไม้โทนทีล: มาก (60)
เขียวป่า: ชัด (45)
แดดบนใบไม้: ปานกลาง (30)

[โทนเงาและไฮไลต์]
สีเงา: เขียวอมฟ้า ชัด (188°, 45)
สีไฮไลต์: ครีม ปานกลาง (40°, 30)

[บรรยากาศและฟิล์ม]
หมอก: ปานกลาง (35)
ฟิล์มจาง: เล็กน้อย (25)
เกรนฟิล์ม: ปานกลาง (30)
ขอบมืด: ปานกลาง (40)

[หมายเหตุ]
โทน teal-green แบบภาพยนตร์ แตะอุ่นเฉพาะจุดโดนแดด ไฮไลต์ครีมจาง เงาลึกอมเขียวน้ำเงิน หมอกเย็นบางด้านบน เกรนและขอบมืดอ่อน

[ห้ามเปลี่ยน]
มุมกล้อง องค์ประกอบ และวัตถุทุกอย่างคงเดิม ไม่เพิ่มหมอกหนาหรือสิ่งก่อสร้าง
```

## หมอกเช้าบนดอย (`builtin:b2`)

แท็ก: ทิวทัศน์, ภูเขา · ไฟล์: `seed/structured-prompts/mountain-morning-mist.sgp.txt`

<details><summary>พร้อมต์ต้นฉบับ (เขียนอิสระ)</summary>

```text
Cool early-morning mountain light. Soft bluish mist rising from the valleys, lifted shadows, gentle low contrast, muted greens leaning toward sage, pale cool highlights. Calm and quiet, no warm cast.
```

</details>

**พร้อมต์แบบโครงสร้าง**

```text
# ชื่อ: หมอกเช้าบนดอย
# แท็ก: ทิวทัศน์, ภูเขา
# รุ่นรูปแบบ: 1

[แสง]
ความสว่าง: สว่างขึ้น นิดเดียว (+8)
คอนทราสต์: นุ่ม เล็กน้อย (-25)
ไฮไลต์: กด นิดเดียว (-10)
เงา: ยก เล็กน้อย (+25)

[สี]
อุณหภูมิสี: เย็น เล็กน้อย (-25)
ทินต์: ม่วงแดง นิดเดียว (+5)
ความอิ่มสี: จาง เล็กน้อย (-20)

[ใบไม้]
ใบไม้โทนทีล: ปานกลาง (30)

[โทนเงาและไฮไลต์]
สีเงา: ฟ้า ปานกลาง (205°, 30)
สีไฮไลต์: ฟ้า นิดเดียว (210°, 12)

[ปรับรายสี]
เขียว: อิ่ม ลด เล็กน้อย (-20)

[บรรยากาศและฟิล์ม]
หมอก: มาก (60)
ระยะหมอก: ยาว (60)
โทนหมอก: เย็น ชัด (-55)
ฟิล์มจาง: ปานกลาง (30)
เกรนฟิล์ม: นิดเดียว (15)
ขอบมืด: นิดเดียว (15)
```

## ฟิล์มอุ่นวินเทจ (`builtin:b3`)

แท็ก: ฟิล์ม, วินเทจ · ไฟล์: `seed/structured-prompts/warm-vintage-film.sgp.txt`

<details><summary>พร้อมต์ต้นฉบับ (เขียนอิสระ)</summary>

```text
Warm nostalgic analog film look. Faded blacks, creamy orange-tinted highlights, slightly green shadows, softened saturation, visible fine grain and a soft vignette, like a 1970s travel photograph.
```

</details>

**พร้อมต์แบบโครงสร้าง**

```text
# ชื่อ: ฟิล์มอุ่นวินเทจ
# แท็ก: ฟิล์ม, วินเทจ
# รุ่นรูปแบบ: 1

[แสง]
คอนทราสต์: นุ่ม นิดเดียว (-10)
ไฮไลต์: กด นิดเดียว (-15)
เงา: ยก นิดเดียว (+10)

[สี]
อุณหภูมิสี: อุ่น เล็กน้อย (+25)
ความอิ่มสี: จาง นิดเดียว (-15)

[โทนเงาและไฮไลต์]
สีเงา: เขียว เล็กน้อย (140°, 25)
สีไฮไลต์: ส้ม ชัด (32°, 45)

[ปรับรายสี]
เหลืองส้ม: เฉด ลด นิดเดียว (-10)
น้ำเงิน: อิ่ม ลด เล็กน้อย (-25)

[บรรยากาศและฟิล์ม]
ฟิล์มจาง: ชัด (55)
เกรนฟิล์ม: ชัด (55)
ขอบมืด: ชัด (45)
```

## Teal & Orange (`builtin:b4`)

แท็ก: cinematic · ไฟล์: `seed/structured-prompts/teal-orange.sgp.txt`

<details><summary>พร้อมต์ต้นฉบับ (เขียนอิสระ)</summary>

```text
Classic blockbuster teal-and-orange grade. Shadows and skies pushed toward teal, warm orange highlights and skin tones, punchy contrast, rich but controlled saturation.
```

</details>

**พร้อมต์แบบโครงสร้าง**

```text
# ชื่อ: Teal & Orange
# แท็ก: cinematic
# รุ่นรูปแบบ: 1

[แสง]
คอนทราสต์: แข็งขึ้น ปานกลาง (+30)
เงา: ลึก เล็กน้อย (-20)

[สี]
ไวบรานซ์: สด เล็กน้อย (+20)

[ใบไม้]
ใบไม้โทนทีล: ปานกลาง (35)

[โทนเงาและไฮไลต์]
สีเงา: เขียวอมฟ้า ชัด (190°, 55)
สีไฮไลต์: ส้ม ชัด (30°, 45)

[ปรับรายสี]
เหลืองส้ม: อิ่ม เพิ่ม นิดเดียว (+15), เฉด ลด นิดเดียว (-10)
เขียวอมฟ้า: เฉด ลด นิดเดียว (-15)
น้ำเงิน: อิ่ม เพิ่ม นิดเดียว (+15), เฉด ลด เล็กน้อย (-25)

[บรรยากาศและฟิล์ม]
ขอบมืด: ปานกลาง (30)
```

## พอร์ตเทรตเด็กสดใส (`builtin:b6`)

แท็ก: พอร์ตเทรต, เด็ก · ไฟล์: `seed/structured-prompts/portrait-kids-bright.sgp.txt`

<details><summary>พร้อมต์ต้นฉบับ (เขียนอิสระ)</summary>

```text
ROLE: Professional Portrait Photo Retoucher & Colorist
TASK:
Enhance the uploaded original photograph to achieve a bright, clean, soft, and cheerful professional portrait photography look. Preserve the original photograph and its authentic details.
1. LIGHTING ENHANCEMENT
* Correct underexposure and uneven lighting.
* Brighten the image naturally with soft, diffused lighting.
* Lift shadows gently while preserving highlights and skin details.
* Balance exposure to create a clean, airy, luminous appearance.
* Avoid excessive brightness, blown highlights, or artificial HDR effects.
2. COLOR GRADING
* Correct the original color cast, especially unwanted green or yellow tones.
* Create natural, fresh, cheerful colors with a soft pastel aesthetic.
* Enhance lavender and purple tones in the fairy costume while maintaining realistic fabric colors.
* Improve skin tone accuracy, keeping the child's complexion natural and healthy.
* Make the background look clean, soft, and neutral without changing its original appearance.
* Apply subtle professional portrait color grading with balanced saturation and contrast.
3. SHARPNESS & DETAIL
* Improve overall clarity and fine detail.
* Enhance natural sharpness around the eyes, eyelashes, hair, clothing textures, fairy wings, and facial decorations.
* Reduce mild image haze and softness.
* Apply subtle noise reduction while retaining natural skin texture.
* Avoid excessive sharpening, artificial skin smoothing, or plastic-looking skin.
4. STRICT PRESERVATION RULES — CRITICAL
* Preserve the original subject's identity and facial features exactly.
* Maintain the original facial expression, eye shape, smile, mouth, nose, and proportions.
* Preserve the original hairstyle, hair ribbons, makeup, face paint, and accessories.
* Keep the original clothing, fairy wings, skirt, patterns, and printed text unchanged.
* Preserve the exact body posture, hand gestures, finger positions, and limb proportions.
* Maintain the original background, composition, camera angle, perspective, and framing.
* Do not add, remove, replace, redraw, or invent any objects.
* Do not alter the subject's age, appearance, or body shape.
* Do not crop, rotate, expand, or reconstruct the image.
* Do not apply beauty filters or AI-generated facial enhancements.
* The task is strictly photographic enhancement, not image regeneration.
5. TARGET LOOK
A professionally retouched children's portrait with:
* Bright, soft, natural lighting.
* Clean, balanced, pastel colors.
* Beautiful lavender and purple tones.
* Natural skin texture and realistic details.
* Improved sharpness and clarity.
* A cheerful, polished, high-quality photography finish.
OUTPUT REQUIREMENTS
* Use the original image dimensions and aspect ratio.
* Preserve all original visual elements and their exact positions.
* Deliver the highest available image quality.
* Make the result look like the same original photograph captured with better lighting, accurate colors, and a sharper camera lens.
FINAL INSTRUCTION:
Enhance ONLY lighting, color, exposure, contrast, and sharpness. Do not change anything else. If any enhancement would require reconstructing or altering the original subject, leave that area unchanged.
```

</details>

**พร้อมต์แบบโครงสร้าง**

```text
# ชื่อ: พอร์ตเทรตเด็กสดใส
# แท็ก: พอร์ตเทรต, เด็ก
# รุ่นรูปแบบ: 1

[แสง]
ความสว่าง: สว่างขึ้น เล็กน้อย (+22)
คอนทราสต์: นุ่ม นิดเดียว (-5)
ไฮไลต์: กด นิดเดียว (-15)
เงา: ยก ปานกลาง (+30)
ลดความมัว: เล็กน้อย (20)

[สี]
อุณหภูมิสี: เย็น นิดเดียว (-4)
ทินต์: ม่วงแดง นิดเดียว (+6)
แก้สีเพี้ยน: มาก (70)
ความอิ่มสี: จาง นิดเดียว (-4)
ไวบรานซ์: สด นิดเดียว (+12)
กันเหลือง: ปานกลาง (30)

[โทนเงาและไฮไลต์]
สีไฮไลต์: ชมพู นิดเดียว (330°, 8)

[ปรับรายสี]
แดง: สว่าง เพิ่ม นิดเดียว (+4)
เหลืองส้ม: อิ่ม ลด นิดเดียว (-15)
เขียว: อิ่ม ลด เล็กน้อย (-25)
ม่วง: อิ่ม เพิ่ม เล็กน้อย (+25), สว่าง เพิ่ม นิดเดียว (+10), เฉด ลด นิดเดียว (-5)

[รายละเอียด]
ความคมชัด: ปานกลาง (35)
ลดจุดรบกวน: เล็กน้อย (25)

[หมายเหตุ]
ทำไม่ได้ใน MVP: ทำฉากหลังให้เป็นกลางโดยไม่กระทบตัวเด็ก และเพิ่มความคมเฉพาะรอบดวงตา (ต้องใช้ mask เฉพาะพื้นที่)

[ห้ามเปลี่ยน]
ใบหน้า สีหน้า ทรงผม เครื่องแต่งกาย ปีกนางฟ้า ท่าทาง ฉากหลัง องค์ประกอบ ขนาดภาพ
```

## ขาวดำคอนทราสต์สูง (`builtin:b5`)

แท็ก: ขาวดำ · ไฟล์: `seed/structured-prompts/bw-high-contrast.sgp.txt`

<details><summary>พร้อมต์ต้นฉบับ (เขียนอิสระ)</summary>

```text
High-contrast black-and-white landscape. Deep blacks, bright clean highlights, darker sky, film grain and a strong vignette.
```

</details>

**พร้อมต์แบบโครงสร้าง**

```text
# ชื่อ: ขาวดำคอนทราสต์สูง
# แท็ก: ขาวดำ
# รุ่นรูปแบบ: 1

[แสง]
คอนทราสต์: แข็งขึ้น ชัด (+45)
ไฮไลต์: สว่างขึ้น นิดเดียว (+10)
เงา: ลึก ปานกลาง (-30)

[สี]
ความอิ่มสี: ขาวดำ (-100)

[ปรับรายสี]
เขียว: สว่าง เพิ่ม นิดเดียว (+10)
น้ำเงิน: สว่าง ลด ชัด (-45)

[บรรยากาศและฟิล์ม]
เกรนฟิล์ม: ปานกลาง (40)
ขอบมืด: ชัด (50)
```

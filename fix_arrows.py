import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Revert max depth container logic
content = re.sub(
    r'const isMaxDepth = depth >= \d+;',
    r'const isMaxDepth = depth >= 3;',
    content
)

# Replace depthIcon logic with the innovative one
replacement = r"""let depthIcon = '';
            if (depth >= 4) {
                const arrowCount = Math.min(depth - 3, 5);
                const colors = ['#9ca3af', '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444'];
                const color = colors[Math.min(depth - 4, 4)];
                const arrows = '&#x21B3;'.repeat(arrowCount);
                depthIcon = `<span style="color: ${color}; font-size: 1.1rem; margin-right: 0.3rem; font-weight: bold; line-height: 1; letter-spacing: -2px;">${arrows}</span>`;
            }"""

content = re.sub(
    r'const depthIcon = depth >= 11 \?.*? : \'\';',
    replacement,
    content,
    flags=re.DOTALL
)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)

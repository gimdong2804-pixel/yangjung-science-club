import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

replacement = r"""let depthIcon = '';
            if (depth >= 4) {
                const arrowCount = depth - 3;
                const arrowText = '&#x21B3; X' + arrowCount;
                depthIcon = `<span style="color: #9ca3af; font-size: 0.9rem; margin-right: 0.4rem; font-weight: bold; line-height: 1;">${arrowText}</span>`;
            }"""

content = re.sub(
    r'let depthIcon = \'\';\s*if \(depth >= 4\) \{.*?\}',
    replacement,
    content,
    flags=re.DOTALL
)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)

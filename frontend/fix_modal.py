import re

with open("src/components/GlobalModal.tsx", "r", encoding="utf-8") as f:
    text = f.read()

# Make inputs bound
text = re.sub(r'<input (type="text"|type="number"|type="email") onChange=\{e => handleInput\(\'(\w+)\', e.target.value\)\}(.*?)\/>',
            r'<input \1 onChange={e => handleInput(\'\2\', e.target.value)} value={formData.\2 || \'\'} \3 />', text)

text = re.sub(r'<select (.*?)onChange=\{e => handleInput\(\'(\w+)\', e.target.value\)\}(.*?)>', 
            r'<select \1onChange={e => handleInput(\'\2\', e.target.value)} value={formData.\2 || \'\'}\3>', text)

text = re.sub(r'<textarea (.*?)onChange=\{e => handleInput\(\'(\w+)\', e.target.value\)\}(.*?)></textarea>',
            r'<textarea \1onChange={e => handleInput(\'\2\', e.target.value)} value={formData.\2 || \'\'}\3></textarea>', text)

with open("src/components/GlobalModal.tsx", "w", encoding="utf-8") as f:
    f.write(text)
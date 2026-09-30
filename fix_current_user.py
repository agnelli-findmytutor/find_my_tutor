with open('app.py', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('request.current_user["id"]', 'get_current_fmt_user_from_request()["id"]')

with open('app.py', 'w', encoding='utf-8') as f:
    f.write(content)

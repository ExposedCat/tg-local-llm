
#!/bin/bash

DESCRIPTION="$(echo "${2:-TG Ollama Service}" | sed 's/\//\\\//g')"
DIR="$(echo "$PWD" | sed 's/\//\\\//g')"
SERVICE="/etc/systemd/system/$1.service"

cp tg-ollama.service $SERVICE
sed -i "s/\$DESCRIPTION/$DESCRIPTION/g" $SERVICE
sed -i "s/\$USER/$SUDO_USER/g" $SERVICE
sed -i "s/\$DIR/$DIR/g" $SERVICE

echo "Service $SERVICE created successfully"
echo " - Start it \`systemctl start $1\`"
echo " - Enable it \`systemctl enable $1\`"

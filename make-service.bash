
#!/bin/bash

DESCRIPTION="$(echo "${2:-TG LLM Service}" | sed 's/\//\\\//g')"
DIR="$(echo "$PWD" | sed 's/\//\\\//g')"
SERVICE="$HOME/.local/share/systemd/user/$1.service"

cp tg-ollama.service $SERVICE
sed -i "s/\$DESCRIPTION/$DESCRIPTION/g" $SERVICE
sed -i "s/\$USER/$USER/g" $SERVICE
sed -i "s/\$DIR/$DIR/g" $SERVICE

systemctl --user daemon-reload

echo "Service $SERVICE created successfully"
echo " - Start it \`systemctl --user start $1\`"
echo " - Enable it \`systemctl --user enable $1\`"

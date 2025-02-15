
#!/bin/bash

DESCRIPTION="$(echo "${2:-TG Local LLM Service}" | sed 's/\//\\\//g')"
DIR="$(echo "$PWD" | sed 's/\//\\\//g')"
SERVICE="$HOME/.local/share/systemd/user/$1.service"

if [ "$#" -eq 4 ]; then
  cp ./systemd/llamacpp.service $SERVICE
else
  cp ./systemd/tg-local-llm.service $SERVICE
fi

LLAMACPP_HOME="$(echo "$3" | sed 's/\//\\\//g')"
MODEL_PATH="$(echo "$4" | sed 's/\//\\\//g')"

sed -i "s/\$DESCRIPTION/$DESCRIPTION/g" $SERVICE
sed -i "s/\$USER/$USER/g" $SERVICE
sed -i "s/\$LLAMACPP_HOME/$LLAMACPP_HOME/g" $SERVICE
sed -i "s/\$MODEL_PATH/$MODEL_PATH/g" $SERVICE
sed -i "s/\$DIR/$DIR/g" $SERVICE

systemctl --user daemon-reload

echo "Service $SERVICE created successfully"
echo " - Start it \`systemctl --user start $1\`"
echo " - Enable it \`systemctl --user enable $1\`"

FROM denoland/deno

WORKDIR /src

COPY . .

RUN ls

RUN deno cache --lock=deno.lock --reload --allow-import src/index.ts

CMD ["deno", "task", "start:raw"]

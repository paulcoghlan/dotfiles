export PATH="$HOME/.jenv/bin:$PATH"

if [ -d "$HOME/.jenv" ]
then
    export PATH="$HOME/.jenv/bin:$PATH"
    eval "$(jenv init -)"
    export PATH="/opt/homebrew/opt/openjdk/bin:$PATH"
fi

if [ -d "$HOME/.nvm" ]
then
   export NVM_DIR="$HOME/.nvm"
   [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
   [ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  
fi

#if [ -d "$HOME/.nix-profile" ]
#then
#   eval "$(direnv hook zsh)"
#fi

autoload -U edit-command-line
# Emacs style
zle -N edit-command-line
bindkey '^xe' edit-command-line
bindkey '^x^e' edit-command-line
export PATH="/opt/homebrew/opt/mysql-client/bin:$PATH"

source <(stern --completion=zsh)
[[ $commands[kubectl] ]] && source <(kubectl completion zsh) # add autocomplete permanently to your zsh shell
export SSH_AUTH_SOCK=~/.ssh/agent

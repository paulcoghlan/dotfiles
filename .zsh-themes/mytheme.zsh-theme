# mytheme.zsh-theme

# Colors
local user_color="%{$fg[green]%}"
local dir_color="%{$fg[cyan]%}"
local git_color="%{$fg[magenta]%}"
local time_color="%{$fg[yellow]%}"
local reset="%{$reset_color%}"

# Time since last commit function
function git_time_since_commit() {
    if git rev-parse --git-dir > /dev/null 2>&1; then
        last_commit=$(git log -1 --pretty=format:'%at' 2>/dev/null)
        if [ -n "$last_commit" ]; then
            now=$(date +%s)
            seconds=$((now - last_commit))
            
            if [ $seconds -lt 60 ]; then
                time_str="${seconds}s"
            elif [ $seconds -lt 3600 ]; then
                time_str="$((seconds / 60))m"
            elif [ $seconds -lt 86400 ]; then
                time_str="$((seconds / 3600))h"
            else
                time_str="$((seconds / 86400))d"
            fi
            
            echo "${time_color}[${time_str}]${reset}"
        fi
    fi
}

# Main prompt
PROMPT='${time_color}%*${reset} ${dir_color}%~${reset} $(git_prompt_info)$(git_time_since_commit)
${user_color}❯${reset} '

# Git prompt configuration
ZSH_THEME_GIT_PROMPT_PREFIX="${git_color}on "
ZSH_THEME_GIT_PROMPT_SUFFIX="${reset} "
ZSH_THEME_GIT_PROMPT_DIRTY=" %{$fg[red]%}✗"
ZSH_THEME_GIT_PROMPT_CLEAN=" %{$fg[green]%}✓"

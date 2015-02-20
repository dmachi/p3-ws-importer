# p3-ws-importer

## Setup

Clone the repo and copy the sample conf

    git clone https://github.com/dmachi/p3-ws-importer
    cd p3-ws-importer
    cp p3-ws-importer.conf.sample p3-ws-importer.conf

Edit the sample conf to add in your patric authorizationToken and other paramters if you dont' want ot pass them on the command line.    

## Examples

Standard Import:

     ./import.js --path /path/to/workspace/home --workspace /{{YOUR USER ID}}@patricbrc.org/home 

Administrative Import

     ./import.js --path /path/to/workspace/home --workspace /{{TARGET USER ID}}/home --admin true --owner {{TARGET_USER_ID}}@patricbrc.org

Mass Import from a folder where the workspaces folder has a folder in the form {{USER ID}}@patricbrc.org for each user workspace

    ./massImport.sh /path/to/workspaces/
    
  
    
    

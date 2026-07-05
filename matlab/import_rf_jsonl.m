function frames = import_rf_jsonl(filename)
%IMPORT_RF_JSONL Read line-delimited RF sensing frames exported by the web app.

fid = fopen(filename, "r");
if fid < 0
    error("Could not open %s", filename);
end

frames = {};
cleanup = onCleanup(@() fclose(fid));

while true
    line = fgetl(fid);
    if ~ischar(line)
        break;
    end
    line = strtrim(line);
    if strlength(line) == 0
        continue;
    end
    frames{end + 1} = jsondecode(line); %#ok<AGROW>
end
end


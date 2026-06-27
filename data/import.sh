
for i in $(ls *json); do

idx=$(echo "sample-prompt-$i" | tr [A-Z] [a-z] | tr -d "_" | sed "s/.json//"); 
python3.9  ./import.py --url http://127.0.0.1:9200 --file ./$i --index $idx;
done

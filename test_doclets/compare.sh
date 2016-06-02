for d in `find test_doclets -mindepth 1 -maxdepth 1 -type d`;
do
  diff -q $d/provide/result $d/module/result || (diff $d/provide/result $d/module/result; diff $d/provide/result_x $d/module/result_x)
done

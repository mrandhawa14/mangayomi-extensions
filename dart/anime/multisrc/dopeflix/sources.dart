import '../../../../model/source.dart';
import 'src/dopebox/dopebox.dart';
import 'src/moviesflix/moviesflix.dart';
import 'src/sflix/sflix.dart';

const _dopeflixVersion = "0.0.11";
const _dopeflixSourceCodeUrl =
    "https://raw.githubusercontent.com/m2k3a/mangayomi-extensions/$branchName/dart/anime/multisrc/dopeflix/dopeflix.dart";

List<Source> get dopeflixSourcesList => _dopeflixSourcesList;
List<Source> _dopeflixSourcesList =
    [
          //DopeBox (EN)
          dopeboxSource,
          //SFlix (EN)
          sflixSource,
          //MoviesFlix (EN)
          moviesflixSource,
        ]
        .map(
          (e) => e
            ..sourceCodeUrl = _dopeflixSourceCodeUrl
            ..version = _dopeflixVersion,
        )
        .toList();

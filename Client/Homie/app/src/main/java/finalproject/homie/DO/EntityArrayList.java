package finalproject.homie.DO;

import java.util.ArrayList;

/**
 * Created by I311044 on 02/06/2017.
 */

public class EntityArrayList<T extends BusinessEntity> extends ArrayList<T> {

    @Override
    public String toString() {
        StringBuilder sb = new StringBuilder();
        for (T obj : this) {
            sb.append(obj.toString());
            sb.append(", ");
        }
        if (sb.length() > 2) {
            sb.delete(sb.length() - 2, sb.length() - 1);
        }
        return sb.toString();
    }
}

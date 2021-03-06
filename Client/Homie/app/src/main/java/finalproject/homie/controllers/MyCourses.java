package finalproject.homie.controllers;

import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.support.design.widget.NavigationView;
import android.support.v7.widget.LinearLayoutManager;
import android.support.v7.widget.RecyclerView;

import java.util.ArrayList;
import java.util.List;

import finalproject.homie.DAL.DataFetcher;
import finalproject.homie.DO.BusinessEntity;
import finalproject.homie.DO.Course;
import finalproject.homie.DO.User;
import finalproject.homie.R;
import finalproject.homie.adapters.CoursesAdapter;
import finalproject.homie.model.Model;

public class MyCourses extends BaseNavigationActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        setContentView(R.layout.activity_course_list);
        super.onCreate(savedInstanceState);
        System.out.print("********Creating activity Courses\n");

        NavigationView navigationView = (NavigationView) findViewById(R.id.nav_view);
        navigationView.setNavigationItemSelectedListener(this);

        this.getIntent().putExtra("RELOAD_DATA", true);
    }

    @Override
    public void setTitle() {
        this.setTitle(getString(R.string.my_courses));
    }

    @Override
    protected void additem() {

    }

    @Override
    protected void onResume() {
        super.onResume();

        if (loggingOut) {
            loggingOut = false;
            return;
        }

        if (this.getIntent().getBooleanExtra("RELOAD_DATA", false)){
            final Model model = ((BaseApplication) getApplication()).getModel();
            final Context me = this;
            List<Course> myCourses = model.getMyCourses();

            final CoursesAdapter ca = new CoursesAdapter(this, myCourses, false, new IEntityClickListener() {
                @Override
                public void onClick(BusinessEntity obj) {
                    model.setSelectedCourse((Course)obj);
                    Intent intent = new Intent(me, MyAssignments.class);
                    intent.addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
                    intent.putExtra("COURSE_ID", obj.getID());
                    startActivity(intent);
                }
            });
            ca.notifyDataSetChanged();

            if (myCourses.isEmpty()) {
                String token = ((BaseApplication) getApplicationContext()).getToken();
                final User connectedUser = ((BaseApplication) getApplicationContext()).getConnectedUser();
                new DataFetcher<Course>(myCourses, token, new IDataResponseHandler() {
                    @Override
                    public void OnError(int errorCode) {
                        // TODO: handle Error
                    }

                    @Override
                    public void OnSuccess(String message) {
                        ca.notifyDataSetChanged();
                    }
                }).getCoursesByUserId(connectedUser.getID());
            }

            RecyclerView mRecyclerView = (RecyclerView) findViewById(R.id.recycler_view);
            mRecyclerView.setHasFixedSize(true);
            LinearLayoutManager mLayoutManager = new LinearLayoutManager(this);
            mRecyclerView.setLayoutManager(mLayoutManager);
            mRecyclerView.setAdapter(ca);
        }
    }
}
